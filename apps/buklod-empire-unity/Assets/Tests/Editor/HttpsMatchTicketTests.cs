using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class HttpsMatchTicketTests {
        static readonly Uri Origin=new Uri("https://example.invalid/");
        static readonly string Ticket=Convert.ToBase64String(new byte[32]);
        sealed class Fake:HttpMessageHandler {
            readonly Func<HttpRequestMessage,HttpResponseMessage> reply;
            public int Calls;
            public Fake(Func<HttpRequestMessage,HttpResponseMessage> reply){this.reply=reply;}
            protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken cancellation){
                cancellation.ThrowIfCancellationRequested();Calls++;return Task.FromResult(reply(request));
            }
        }
        static HttpResponseMessage Response(HttpStatusCode status,string body)=>new HttpResponseMessage(status){Content=new StringContent(body,System.Text.Encoding.ASCII,"text/plain")};
        [Test] public void RejectNonHttpsAndCredentials(){
            foreach(var url in new[]{"http://example.invalid/","https://user@example.invalid/","https://example.invalid/path","https://example.invalid/?x=1","https://example.invalid/#x","https://example.invalid:8443/"})
                Assert.Throws<ArgumentException>(()=>new HttpsMatchTicketProvider(new Uri(url),_=>Task.FromResult("token")));
            Assert.False(HttpsMatchTicketProvider.IsCanonicalTicket(new string('A',44)));
            Assert.False(HttpsMatchTicketProvider.IsCanonicalTicket(Ticket+" "));
            Assert.True(HttpsMatchTicketProvider.IsCanonicalTicket(Ticket));
        }
        [Test] public async Task SendsOnlyCurrentBearerAndMatchId(){
            var id=Guid.NewGuid();int tokenCalls=0;
            var handler=new Fake(req=>{
                Assert.AreEqual(HttpMethod.Post,req.Method);
                Assert.AreEqual(new Uri(Origin,"matches/"+id.ToString("D")+"/ticket"),req.RequestUri);
                Assert.AreEqual("Bearer",req.Headers.Authorization.Scheme);
                Assert.AreEqual("token"+tokenCalls,req.Headers.Authorization.Parameter);
                Assert.True(req.Headers.CacheControl.NoStore);
                return Response(HttpStatusCode.OK,Ticket);
            });
            using(var provider=new HttpsMatchTicketProvider(Origin,_=>Task.FromResult("token"+(++tokenCalls)),handler)){
                Assert.AreEqual(Ticket,await provider.RequestFreshTicket(id,CancellationToken.None));
                Assert.AreEqual(Ticket,await provider.RequestFreshTicket(id,CancellationToken.None));
                Assert.AreEqual(2,handler.Calls);
            }
        }
        [Test] public async Task RejectsUnauthorizedMalformedAndOversizedResponses(){
            foreach(var body in new[]{"",Ticket+"x",new string('!',44),new string('x',5000)}){
                using(var provider=new HttpsMatchTicketProvider(Origin,_=>Task.FromResult("token"),new Fake(_=>Response(HttpStatusCode.OK,body))))
                    Assert.IsNull(await provider.RequestFreshTicket(Guid.NewGuid(),CancellationToken.None));
            }
            using(var provider=new HttpsMatchTicketProvider(Origin,_=>Task.FromResult("token"),new Fake(_=>Response(HttpStatusCode.Unauthorized,Ticket))))
                Assert.IsNull(await provider.RequestFreshTicket(Guid.NewGuid(),CancellationToken.None));
        }
        [Test] public async Task InvalidSessionNeverSendsHttp(){
            var handler=new Fake(_=>throw new InvalidOperationException("Network must not be called"));
            using(var provider=new HttpsMatchTicketProvider(Origin,_=>Task.FromResult("bad\r\n"),handler)){
                Assert.IsNull(await provider.RequestFreshTicket(Guid.NewGuid(),CancellationToken.None));
                Assert.IsNull(await provider.RequestFreshTicket(Guid.Empty,CancellationToken.None));
                Assert.AreEqual(0,handler.Calls);
            }
        }
    }
}
