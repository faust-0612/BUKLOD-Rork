using System;
using System.IO;
using System.Net.WebSockets;
using System.Threading;
using System.Threading.Tasks;
namespace Buklod.Empire {
    public static class MatchSocketFrames {
        public static async Task<byte[]> Read(WebSocket socket,int max,CancellationToken token){
            if(socket==null||max<=0||max>MatchWire.MaxSnapshotBytes)throw new ArgumentException("Invalid frame limit.");
            var bytes=new byte[max];int total=0;
            do{
                if(total==max)throw new InvalidDataException("Frame too large.");
                var r=await socket.ReceiveAsync(new ArraySegment<byte>(bytes,total,max-total),token);
                if(r.MessageType==WebSocketMessageType.Close)return null;
                if(r.MessageType!=WebSocketMessageType.Binary||r.Count==0&&!r.EndOfMessage)throw new InvalidDataException("Invalid binary frame.");
                total+=r.Count;
                if(r.EndOfMessage){Array.Resize(ref bytes,total);return bytes;}
            }while(true);
        }
        public static async Task Send(WebSocket socket,byte[] frame,CancellationToken token){
            if(frame==null||frame.Length==0||frame.Length>MatchWire.MaxSnapshotBytes)throw new InvalidDataException("Invalid outgoing frame.");
            using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(token)){
                deadline.CancelAfter(TimeSpan.FromSeconds(2));
                await socket.SendAsync(new ArraySegment<byte>(frame),WebSocketMessageType.Binary,true,deadline.Token);
            }
        }
    }
    // Server transport adapter. The hosting layer must enforce TLS at the public
    // ingress, reject unauthenticated upgrades by rate limit and supply a real WebSocket.
    // No reward settlement or public listener is provided here.
#if UNITY_EDITOR || UNITY_SERVER
    public sealed class MatchSocketEndpoint {
        readonly MatchGrantService grants;readonly MatchLoop loop;readonly IMatchIdentityVerifier identity;
        readonly SemaphoreSlim sockets=new SemaphoreSlim(20,20),authRequests=new SemaphoreSlim(8,8);
        public MatchSocketEndpoint(MatchGrantService grants,MatchLoop loop,IMatchIdentityVerifier identity){
            this.grants=grants??throw new ArgumentNullException(nameof(grants));this.loop=loop??throw new ArgumentNullException(nameof(loop));this.identity=identity??throw new ArgumentNullException(nameof(identity));
        }
        // HTTPS control-plane handler calls this with the Authorization bearer only.
        public async Task<string> RequestTicket(string bearer,CancellationToken cancellation){
            if(string.IsNullOrEmpty(bearer)||bearer.Length>8192||!await authRequests.WaitAsync(0,cancellation).ConfigureAwait(false))return null;
            try{
                using(var timeout=CancellationTokenSource.CreateLinkedTokenSource(cancellation)){
                    timeout.CancelAfter(TimeSpan.FromSeconds(5));
                    string account=await identity.VerifyAccountAsync(bearer,timeout.Token).ConfigureAwait(false);
                    if(string.IsNullOrWhiteSpace(account))return null;
                    return await loop.Invoke(()=>grants.IssueVerified(account),timeout.Token).ConfigureAwait(false);
                }
            }catch(OperationCanceledException){return null;}catch(System.Net.Http.HttpRequestException){return null;}catch(InvalidOperationException){return null;}
            finally{authRequests.Release();}
        }
        public async Task Run(WebSocket socket,CancellationToken cancellation){
            if(socket==null)throw new ArgumentNullException(nameof(socket));
            if(!await sockets.WaitAsync(0,cancellation)){socket.Abort();socket.Dispose();return;}
            MatchSession session=null;
            using(var lifetime=CancellationTokenSource.CreateLinkedTokenSource(cancellation)){
                try{
                    using(var handshake=CancellationTokenSource.CreateLinkedTokenSource(lifetime.Token)){
                        handshake.CancelAfter(TimeSpan.FromSeconds(5));
                        var hello=await MatchSocketFrames.Read(socket,MatchWire.MaxClientBytes,handshake.Token);
                        if(!MatchWire.TryDecodeClient(hello,out var type,out var id,out var ticket,out _)||type!=MatchWire.Hello)return;
                        session=await loop.Invoke(()=>grants.Redeem(id,MatchWire.Version,ticket),handshake.Token);
                        if(session==null)return;
                    }
                    var read=ReadInputs(socket,session,lifetime.Token);
                    var write=WriteSnapshots(socket,session,lifetime.Token);
                    await Task.WhenAny(read,write);
                    lifetime.Cancel();socket.Abort();
                    try{await Task.WhenAll(read,write);}catch(OperationCanceledException){}catch(WebSocketException){}catch(IOException){}catch(InvalidOperationException){}
                }catch(OperationCanceledException){}catch(WebSocketException){}catch(IOException){}catch(InvalidOperationException){}
                finally{
                    lifetime.Cancel();socket.Abort();socket.Dispose();
                    if(session!=null){
                        using(var cleanup=new CancellationTokenSource(TimeSpan.FromSeconds(2))){
                            try{await loop.Invoke(()=>grants.Close(session),cleanup.Token);}catch(OperationCanceledException){}catch(InvalidOperationException){}
                        }
                    }
                    sockets.Release();
                }
            }
        }
        async Task ReadInputs(WebSocket socket,MatchSession session,CancellationToken token){
            var watch=System.Diagnostics.Stopwatch.StartNew();int count=0;
            while(!token.IsCancellationRequested){
                var bytes=await MatchSocketFrames.Read(socket,MatchWire.MaxClientBytes,token);if(bytes==null)return;
                if(watch.ElapsedMilliseconds>=1000){watch.Restart();count=0;}
                if(++count>25||!MatchWire.TryDecodeClient(bytes,out var type,out _,out _,out var input)||type==MatchWire.Hello)return;
                if(type==MatchWire.Ping){if(!await loop.Invoke(()=>grants.Heartbeat(session),token))return;}
                else await loop.Invoke(()=>grants.Submit(session,input),token); // rejection is reported by authoritative ack
            }
        }
        async Task WriteSnapshots(WebSocket socket,MatchSession session,CancellationToken token){
            int sentTick=-1;
            while(!token.IsCancellationRequested){
                var snapshot=await loop.Invoke(()=>grants.Snapshot(session),token);if(snapshot==null)return;
                if(snapshot.Tick!=sentTick){
                    await MatchSocketFrames.Send(socket,MatchWire.EncodeSnapshot(snapshot),token);sentTick=snapshot.Tick;
                    // Final result can be fetched after reconnect only when final-result retention is implemented.
                    if(snapshot.Finished){await Task.Delay(1000,token);return;}
                }
                await Task.Delay(50,token);
            }
        }
    }
#endif
    // Client transport foundation. The Unity online presentation adapter will consume
    // the received snapshot DTOs; do not run a separate rewarding local simulation.
    public sealed class MatchSocketClient:IDisposable {
        readonly ClientWebSocket socket=new ClientWebSocket();
        readonly SemaphoreSlim send=new SemaphoreSlim(1,1);
        public async Task Connect(Uri endpoint,Guid match,string ticket,CancellationToken cancellation){
            if(endpoint==null||endpoint.Scheme!="wss"||!string.IsNullOrEmpty(endpoint.UserInfo)||!string.IsNullOrEmpty(endpoint.Query)||!string.IsNullOrEmpty(endpoint.Fragment))
                throw new ArgumentException("A clean encrypted match endpoint is required.");
            if(ticket==null||ticket.Length!=44||match==Guid.Empty)throw new ArgumentException("Invalid match grant.");
            using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(cancellation)){
                deadline.CancelAfter(TimeSpan.FromSeconds(8));
                try{
                    await socket.ConnectAsync(endpoint,deadline.Token);
                    await MatchSocketFrames.Send(socket,MatchWire.EncodeHello(match,ticket),deadline.Token);
                }catch{socket.Abort();throw;}
            }
        }
        public Task SendInput(MatchInput input,CancellationToken token)=>Send(MatchWire.EncodeInput(input),token);
        public Task Ping(CancellationToken token)=>Send(MatchWire.EncodePing(),token);
        async Task Send(byte[] frame,CancellationToken token){
            if(!await send.WaitAsync(0,token))throw new InvalidOperationException("Send already in progress.");
            try{await MatchSocketFrames.Send(socket,frame,token);}finally{send.Release();}
        }
        // Exactly one receive consumer; full snapshot parsing/render integration remains next.
        public async Task<byte[]> ReceiveSnapshot(CancellationToken token){
            using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(token)){
                deadline.CancelAfter(TimeSpan.FromSeconds(5));
                var bytes=await MatchSocketFrames.Read(socket,MatchWire.MaxSnapshotBytes,deadline.Token);
                if(bytes==null)return null;
                if(bytes.Length<2||bytes[0]!=MatchWire.Version||bytes[1]!=MatchWire.Snapshot)throw new InvalidDataException("Unexpected server frame.");
                return bytes;
            }
        }
        public void Dispose(){socket.Abort();socket.Dispose();}
    }
}
