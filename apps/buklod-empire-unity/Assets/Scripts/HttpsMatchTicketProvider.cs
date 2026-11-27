using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
namespace Buklod.Empire {
    // Runtime adapter for the isolated, authenticated match control plane.
    // No endpoint, account token or signing secret is bundled in this source.
    public sealed class HttpsMatchTicketProvider:IOnlineTicketProvider,IDisposable {
        readonly Uri origin;
        readonly Func<CancellationToken,Task<string>> accessToken;
        readonly HttpClient client;
        public HttpsMatchTicketProvider(Uri origin,Func<CancellationToken,Task<string>> accessToken)
            :this(origin,accessToken,new HttpClientHandler{AllowAutoRedirect=false,UseCookies=false}){}
#if UNITY_EDITOR
        public
#else
        private
#endif
        HttpsMatchTicketProvider(Uri origin,Func<CancellationToken,Task<string>> accessToken,HttpMessageHandler handler){
            if(origin==null||!origin.IsAbsoluteUri||origin.Scheme!="https"||!origin.IsDefaultPort||
               origin.AbsolutePath!="/"||!string.IsNullOrEmpty(origin.UserInfo)||!string.IsNullOrEmpty(origin.Query)||
               !string.IsNullOrEmpty(origin.Fragment)||accessToken==null||handler==null)
                throw new ArgumentException("An explicit HTTPS control-plane origin and session provider are required.");
            this.origin=origin;this.accessToken=accessToken;
            client=new HttpClient(handler,true){Timeout=TimeSpan.FromSeconds(5)};
        }
        public static bool IsCanonicalTicket(string value){
            if(value==null||value.Length!=44)return false;
            try{var bytes=Convert.FromBase64String(value);return bytes.Length==32&&Convert.ToBase64String(bytes)==value;}
            catch(FormatException){return false;}
        }
        static bool SafeBearer(string value){
            if(string.IsNullOrEmpty(value)||value.Length>8192)return false;
            foreach(char c in value)if(c<=32||c>=127)return false;
            return true;
        }
        public async Task<string> RequestFreshTicket(Guid matchId,CancellationToken cancellation){
            if(matchId==Guid.Empty)return null;
            using(var deadline=CancellationTokenSource.CreateLinkedTokenSource(cancellation)){
                deadline.CancelAfter(TimeSpan.FromSeconds(5));
                // Session owner supplies a current token, never a caller-supplied account identity.
                var token=await accessToken(deadline.Token);
                deadline.Token.ThrowIfCancellationRequested();
                if(!SafeBearer(token))return null;
                var endpoint=new Uri(origin,"matches/"+matchId.ToString("D")+"/ticket");
                using(var request=new HttpRequestMessage(HttpMethod.Post,endpoint)){
                    request.Headers.Authorization=new AuthenticationHeaderValue("Bearer",token);
                    request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/plain"));
                    request.Headers.CacheControl=new CacheControlHeaderValue{NoCache=true,NoStore=true};
                    request.Content=new ByteArrayContent(Array.Empty<byte>());
                    using(var response=await client.SendAsync(request,HttpCompletionOption.ResponseHeadersRead,deadline.Token).ConfigureAwait(false)){
                        if(response.StatusCode!=HttpStatusCode.OK||response.Content==null||
                           response.Content.Headers.ContentType?.MediaType!="text/plain"||
                           (response.Content.Headers.ContentLength.HasValue&&response.Content.Headers.ContentLength.Value!=44))return null;
                        using(var stream=await response.Content.ReadAsStreamAsync().ConfigureAwait(false)){
                            var data=new byte[45];int total=0;
                            while(total<data.Length){
                                int n=await stream.ReadAsync(data,total,data.Length-total,deadline.Token).ConfigureAwait(false);
                                if(n==0)break;total+=n;
                            }
                            if(total!=44)return null;
                            var ticket=Encoding.ASCII.GetString(data,0,total);
                            return IsCanonicalTicket(ticket)?ticket:null;
                        }
                    }
                }
            }
        }
        public void Dispose(){client.Dispose();}
    }
}
