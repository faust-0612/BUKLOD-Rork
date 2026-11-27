#if UNITY_EDITOR || UNITY_SERVER
using System;
using System.Threading;
using System.Threading.Tasks;
namespace Buklod.Empire {
    // Store implementation must use the leased private database functions and
    // an exclusive host ID. False/exception is not evidence that a mutation failed.
    public interface IOnlineStartStore {
        Task<bool> RenewLease(Guid matchId,Guid hostId,CancellationToken cancellation);
        Task<bool> StartReserved(Guid matchId,Guid hostId,CancellationToken cancellation);
    }
    public enum DurableStartState {Waiting,Confirming,Running,Finished,RecoveryRequired}
    // Pump from the simulation owner thread only. No async continuation touches Unity state.
    // The caller owns the durable reservation and recovery worker.
    public sealed class DurableMatchStart:IDisposable {
        readonly Guid matchId,hostId;
        readonly MatchServerDriver driver;
        readonly MatchGrantService grants;
        readonly IOnlineStartStore store;
        readonly Func<double> clock;
        readonly int owner=Thread.CurrentThread.ManagedThreadId;
        readonly CancellationTokenSource stop=new CancellationTokenSource();
        CancellationTokenSource operation;
        Task<bool> pending;
        bool starting,disposed;
        double sentAt,renewAt,leaseValidUntil,waitUntil;
        public DurableStartState State{get;private set;}=DurableStartState.Waiting;
        public DurableMatchStart(Guid matchId,Guid hostId,MatchServerDriver driver,MatchGrantService grants,IOnlineStartStore store,Func<double> monotonicSeconds=null){
            if(matchId==Guid.Empty||hostId==Guid.Empty||driver==null||grants==null||grants.MatchId!=matchId||store==null)throw new ArgumentException("Invalid durable room.");
            this.matchId=matchId;this.hostId=hostId;this.driver=driver;this.grants=grants;this.store=store;
            var watch=System.Diagnostics.Stopwatch.StartNew();clock=monotonicSeconds??(()=>watch.Elapsed.TotalSeconds);
            // Initial renewal required before simulation. Conservative local lease budget.
            renewAt=clock();leaseValidUntil=clock()+5;waitUntil=clock()+120;
        }
        void Owner(){if(Thread.CurrentThread.ManagedThreadId!=owner)throw new InvalidOperationException("Use room owner thread.");}
        void Begin(bool start,double now){
            starting=start;sentAt=now;
            operation=CancellationTokenSource.CreateLinkedTokenSource(stop.Token);operation.CancelAfter(TimeSpan.FromSeconds(5));
            try{pending=start?store.StartReserved(matchId,hostId,operation.Token):store.RenewLease(matchId,hostId,operation.Token);if(pending==null)Fail();}
            catch(Exception){Fail();}
            if(start&&State!=DurableStartState.RecoveryRequired)State=DurableStartState.Confirming;
        }
        void Fail(){
            State=DurableStartState.RecoveryRequired;
            if(operation!=null)operation.Cancel();
            driver.Dispose(); // stop input and simulation, never synthesize completion
        }
        public void Pump(){
            Owner();if(disposed||State==DurableStartState.RecoveryRequired)return;
            double now=clock();
            if(State==DurableStartState.Finished){driver.Pump();return;}
            if(now>=leaseValidUntil||State!=DurableStartState.Running&&now>=waitUntil){Fail();return;}
            if(pending!=null){
                if(now-sentAt>=5){Fail();return;}
                if(pending.IsCompleted){
                    bool confirmed=pending.Status==TaskStatus.RanToCompletion&&pending.Result;
                    if(pending.IsFaulted){var ignored=pending.Exception;}
                    pending=null;operation.Dispose();operation=null;
                    if(!confirmed){Fail();return;}
                    if(starting){
                        // A disconnect during the transaction is ambiguous for start; abort/recover.
                        if(!driver.StartMatch()){Fail();return;}
                        State=DurableStartState.Running;
                    }else{leaseValidUntil=sentAt+25;renewAt=sentAt+10;}
                }
            }
            if(State==DurableStartState.Running){
                driver.Pump();
                if(driver.Faulted){Fail();return;}
                if(grants.Finished){State=DurableStartState.Finished;return;}
            }else driver.Pump(); // ticket/heartbeat tasks only; simulation remains stopped
            if(pending!=null)return;
            if(now>=renewAt){Begin(false,now);return;}
            if(State==DurableStartState.Waiting&&grants.ConnectedCount==AuthoritativeMatch.ParticipantCount&&leaseValidUntil-now>=10)Begin(true,now);
        }
        public void Dispose(){
            Owner();if(disposed)return;disposed=true;stop.Cancel();
            if(pending!=null&&pending.IsFaulted){var ignored=pending.Exception;}
            operation?.Dispose();stop.Dispose();driver.Dispose();
        }
    }
}
#endif
