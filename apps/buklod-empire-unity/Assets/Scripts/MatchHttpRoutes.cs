#if UNITY_EDITOR || UNITY_SERVER
using System;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
namespace Buklod.Empire {
    public enum MatchRouteKind {Invalid,Ticket,Socket}
    // Adapter for a dedicated server's protected loopback HTTP listener.
    // TLS and rate limits must be enforced by an independently configured ingress.
    // Only a trusted host registry can resolve a reserved room.
    public sealed class MatchHttpRoutes {
        readonly Func<Guid,MatchSocketEndpoint> resolve;
        readonly SemaphoreSlim requests=new SemaphoreSlim(64,64);
        public MatchHttpRoutes(Func<Guid,MatchSocketEndpoint> resolve){
            this.resolve=resolve??throw new ArgumentNullException(nameof(resolve));
        }
        public static MatchRouteKind Parse(string rawUrl,string method,out Guid id){
            id=Guid.Empty;
            if(string.IsNullOrEmpty(rawUrl)||rawUrl.Length>100||rawUrl.Contains("?")||rawUrl.Contains("#")||rawUrl.Contains("%"))return MatchRouteKind.Invalid;
            var parts=rawUrl.Split('/');
            if(parts.Length!=4||parts[0]!=""||parts[1]!="matches"||!Guid.TryParseExact(parts[2],"D",out var parsed)||parsed==Guid.Empty||parts[2]!=parsed.ToString("D"))return MatchRouteKind.Invalid;
            if(parts[3]=="ticket"&&method=="POST"){id=parsed;return MatchRouteKind.Ticket;}
            if(parts[3]=="socket"&&method=="GET"){id=parsed;return MatchRouteKind.Socket;}
            return MatchRouteKind.Invalid;
        }
        public static string Bearer(string header){
            if(header==null||!header.StartsWith("Bearer ",StringComparison.OrdinalIgnoreCase)||header.Length<8||header.Length>8199)return null;
            string token=header.Substring(7);foreach(char c in token)if(c<=32||c>=127||c==',')return null;
            return token;
        }
        static void Reply(HttpListenerResponse response,int status,string ticket=null){
            response.StatusCode=status;response.Headers["Cache-Control"]="no-store";response.Headers["X-Content-Type-Options"]="nosniff";
            response.ContentType="text/plain";byte[] bytes=ticket==null?Array.Empty<byte>():Encoding.ASCII.GetBytes(ticket);
            response.ContentLength64=bytes.Length;
            try{if(bytes.Length>0)response.OutputStream.Write(bytes,0,bytes.Length);}finally{response.Close();}
        }
        public async Task Handle(HttpListenerContext context,CancellationToken cancellation){
            if(context==null)throw new ArgumentNullException(nameof(context));
            bool admitted=false,upgraded=false;
            try{
                var request=context.Request;
                // A reverse proxy must connect locally. Never trust forwarded IP/host headers.
                if(request.RemoteEndPoint==null||!IPAddress.IsLoopback(request.RemoteEndPoint.Address)){Reply(context.Response,403);return;}
                if(!await requests.WaitAsync(0,cancellation).ConfigureAwait(false)){Reply(context.Response,503);return;}admitted=true;
                var kind=Parse(request.RawUrl,request.HttpMethod,out var id);
                if(kind==MatchRouteKind.Invalid){Reply(context.Response,404);return;}
                if(request.HasEntityBody){Reply(context.Response,400);return;}
                string bearer=kind==MatchRouteKind.Ticket?Bearer(request.Headers["Authorization"]):null;
                if(kind==MatchRouteKind.Ticket&&bearer==null){Reply(context.Response,401);return;}
                var endpoint=resolve(id);
                // Missing or inaccessible rooms get the same generic failure as invalid membership.
                if(endpoint==null){Reply(context.Response,403);return;}
                if(kind==MatchRouteKind.Ticket){
                    if(request.IsWebSocketRequest){Reply(context.Response,400);return;}
                    var ticket=await endpoint.RequestTicket(bearer,cancellation).ConfigureAwait(false);
                    if(!HttpsMatchTicketProvider.IsCanonicalTicket(ticket)){Reply(context.Response,403);return;}
                    Reply(context.Response,200,ticket);return;
                }
                if(!request.IsWebSocketRequest){Reply(context.Response,400);return;}
                var accepted=await context.AcceptWebSocketAsync(null).ConfigureAwait(false);
                upgraded=true;
                await endpoint.Run(accepted.WebSocket,cancellation).ConfigureAwait(false);
            }catch(OperationCanceledException){if(!upgraded)TryAbort(context);}
            catch(HttpListenerException){if(!upgraded)TryAbort(context);}
            catch(System.IO.IOException){if(!upgraded)TryAbort(context);}
            catch(InvalidOperationException){if(!upgraded)TryAbort(context);}
            catch(System.Net.WebSockets.WebSocketException){if(!upgraded)TryAbort(context);}
            finally{if(admitted)requests.Release();}
        }
        static void TryAbort(HttpListenerContext c){try{c.Response.Abort();}catch(ObjectDisposedException){}catch(HttpListenerException){}}
    }
}
#endif
