using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
namespace Buklod.Empire {
    // Implemented by authenticated lobby/control-plane client. Never takes a claimed account ID.
    public interface IOnlineTicketProvider {
        Task<string> RequestFreshTicket(Guid matchId,CancellationToken cancellation);
    }
    public enum OnlineConnectionState {Idle,Connecting,Waiting,Playing,Reconnecting,Finished,Unavailable}
    // Run from Unity main thread with its synchronization context. One connection, one
    // receive consumer, one send producer; bounded attempts and no action replay.
    public sealed class OnlineMatchConnection {
        const int RetryLimit=4,ActionLimit=4;
        readonly int owner=Thread.CurrentThread.ManagedThreadId;
        readonly Queue<(MatchAction action,Vector2 aim,int target,string text)> actions=new Queue<(MatchAction,Vector2,int,string)>();
        readonly Guid matchId;readonly Uri endpoint;readonly IOnlineTicketProvider tickets;
        long sequence;int scheduledTick;Vector2 movement;
        bool running;
        public OnlineTimeline Timeline{get;}=new OnlineTimeline();
        public OnlineConnectionState State{get;private set;}=OnlineConnectionState.Idle;
        public OnlineMatchConnection(Guid matchId,Uri endpoint,IOnlineTicketProvider tickets){
            if(matchId==Guid.Empty||endpoint==null||endpoint.Scheme!="wss"||tickets==null)throw new ArgumentException("Invalid match connection.");
            this.matchId=matchId;this.endpoint=endpoint;this.tickets=tickets;
        }
        void Owner(){if(Thread.CurrentThread.ManagedThreadId!=owner)throw new InvalidOperationException("Use the Unity owner thread.");}
        void ClearIntent(){movement=Vector2.zero;actions.Clear();scheduledTick=0;}
        public void SetMovement(Vector2 direction){
            Owner();if(State!=OnlineConnectionState.Playing||float.IsNaN(direction.x)||float.IsNaN(direction.y)||float.IsInfinity(direction.x)||float.IsInfinity(direction.y)){movement=Vector2.zero;return;}
            movement=Vector2.ClampMagnitude(direction,1);
        }
        public void SuspendInput(){Owner();movement=Vector2.zero;actions.Clear();}
        public bool QueueAction(MatchAction action,Vector2 aim=default,int target=0,string text=null){
            Owner();if(State!=OnlineConnectionState.Playing||actions.Count>=ActionLimit||action==MatchAction.None||!new MatchInput(1,1,Vector2.zero,action,aim,target,text).Valid())return false;
            actions.Enqueue((action,aim,target,text));return true;
        }
        public async Task Run(CancellationToken cancellation){
            Owner();if(running||State==OnlineConnectionState.Finished||SynchronizationContext.Current==null)throw new InvalidOperationException("Use one active Unity connection.");
            running=true;
            try{
                for(int attempt=0;attempt<=RetryLimit&&!cancellation.IsCancellationRequested;attempt++){
                    Owner();ClearIntent();Timeline.Disconnect();State=attempt==0?OnlineConnectionState.Connecting:OnlineConnectionState.Reconnecting;
                    if(attempt>0)await Task.Delay(TimeSpan.FromSeconds(Math.Min(8,1<<(attempt-1))),cancellation);
                    using(var client=new MatchSocketClient())using(var link=CancellationTokenSource.CreateLinkedTokenSource(cancellation)){
                        try{
                            string ticket;
                            using(var timeout=CancellationTokenSource.CreateLinkedTokenSource(link.Token)){
                                timeout.CancelAfter(TimeSpan.FromSeconds(5));ticket=await tickets.RequestFreshTicket(matchId,timeout.Token);
                            }
                            if(string.IsNullOrEmpty(ticket))throw new InvalidOperationException("Match grant unavailable.");
                            await client.Connect(endpoint,matchId,ticket,link.Token);
                            State=OnlineConnectionState.Waiting;
                            var receive=Receive(client,link.Token);var send=Send(client,link.Token);
                            await Task.WhenAny(receive,send);link.Cancel();
                            if(Timeline.Current==null||!Timeline.Current.Finished){Timeline.Disconnect();State=OnlineConnectionState.Reconnecting;ClearIntent();}
                            try{await Task.WhenAll(receive,send);}catch(OperationCanceledException){}catch(System.IO.IOException){}catch(System.Net.WebSockets.WebSocketException){}catch(InvalidOperationException){}
                            if(Timeline.Current!=null&&Timeline.Current.Finished){State=OnlineConnectionState.Finished;ClearIntent();return;}
                        }catch(OperationCanceledException)when(!cancellation.IsCancellationRequested){}
                        catch(System.IO.IOException){}catch(System.Net.WebSockets.WebSocketException){}catch(System.Net.Http.HttpRequestException){}catch(InvalidOperationException){}
                        finally{link.Cancel();ClearIntent();}
                    }
                }
            }catch(OperationCanceledException)when(cancellation.IsCancellationRequested){}
            finally{running=false;ClearIntent();if(State!=OnlineConnectionState.Finished){Timeline.Disconnect();State=cancellation.IsCancellationRequested?OnlineConnectionState.Idle:OnlineConnectionState.Unavailable;}}
        }
        async Task Receive(MatchSocketClient client,CancellationToken token){
            while(!token.IsCancellationRequested){
                var snapshot=await client.ReceiveDecoded(token);Owner();if(snapshot==null)return;
                if(!Timeline.Accept(snapshot)){
                    // Identical tick is a liveness refresh only. Identity or regressing ack is fatal.
                    var current=Timeline.Current;
                    if(current!=null&&Timeline.Connected&&snapshot.Tick==current.Tick&&snapshot.OwnUnitId==current.OwnUnitId&&snapshot.Team==current.Team&&
                       snapshot.AcceptedSequence>=current.AcceptedSequence&&snapshot.AppliedSequence>=current.AppliedSequence&&!snapshot.Finished)continue;
                    throw new InvalidOperationException("Snapshot identity or ordering mismatch.");
                }
                sequence=Math.Max(sequence,snapshot.AcceptedSequence);
                if(snapshot.Finished)return;
                State=snapshot.Tick==0?OnlineConnectionState.Waiting:OnlineConnectionState.Playing;
            }
        }
        async Task Send(MatchSocketClient client,CancellationToken token){
            var ping=System.Diagnostics.Stopwatch.StartNew();
            while(!token.IsCancellationRequested){
                Owner();var snapshot=Timeline.Current;
                if(State==OnlineConnectionState.Playing&&Timeline.Connected&&snapshot!=null&&!snapshot.Finished){
                    int next=snapshot.Tick+2;
                    if(next>scheduledTick){
                        if(sequence==long.MaxValue)throw new InvalidOperationException("Sequence exhausted.");
                        var a=actions.Count>0?actions.Dequeue():(MatchAction.None,Vector2.zero,0,(string)null);
                        await client.SendInput(new MatchInput(++sequence,next,movement,a.Item1,a.Item2,a.Item3,a.Item4),token);
                        scheduledTick=next;ping.Restart();
                    }
                }
                if(ping.ElapsedMilliseconds>=2000){await client.Ping(token);ping.Restart();}
                await Task.Delay(50,token);
            }
        }
    }
}
