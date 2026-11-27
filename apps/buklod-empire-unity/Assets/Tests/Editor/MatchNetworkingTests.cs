using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class MatchNetworkingTests {
        static ArenaDraftPick[] Draft()=>HeroKitCatalog.All.Take(10).Select((h,i)=>new ArenaDraftPick("player"+i,h.Id,i<5?ArenaTeam.Lux:ArenaTeam.Tenebra)).ToArray();
        sealed class FakeVerifier:IMatchIdentityVerifier {
            public Task<string> VerifyAccountAsync(string bearer,CancellationToken token)=>Task.FromResult(bearer=="valid"?"player0":bearer=="outsider"?"unknown":null);
        }
        static string Ticket(MatchSocketEndpoint endpoint,MatchLoop loop,string bearer){
            using(var cancel=new CancellationTokenSource(TimeSpan.FromSeconds(6))){
                var task=endpoint.RequestTicket(bearer,cancel.Token);
                var timer=System.Diagnostics.Stopwatch.StartNew();
                while(!task.IsCompleted&&timer.ElapsedMilliseconds<6500){loop.Pump();Thread.Sleep(1);}
                Assert.True(task.IsCompleted,"Ticket request did not complete within the bounded test window.");
                return task.GetAwaiter().GetResult();
            }
        }
        [Test] public void WireGoldenInputAndMalformedFrames(){
            var input=new MatchInput(42,7,new Vector2(.5f,-.5f),MatchAction.Cast,Vector2.right,2);
            var bytes=MatchWire.EncodeInput(input);
            Assert.AreEqual("01022a00000000000000070000000000003f000000bf0000803f00000000040200000000",BitConverter.ToString(bytes).Replace("-","").ToLowerInvariant());
            Assert.True(MatchWire.TryDecodeClient(bytes,out var type,out _,out _,out var decoded));
            Assert.AreEqual(MatchWire.Input,type);Assert.AreEqual(input.Sequence,decoded.Sequence);Assert.AreEqual(input.Movement,decoded.Movement);
            Assert.False(MatchWire.TryDecodeClient(bytes.Concat(new byte[]{0}).ToArray(),out _,out _,out _,out _));
            Assert.False(MatchWire.TryDecodeClient(bytes.Take(bytes.Length-1).ToArray(),out _,out _,out _,out _));
            bytes[0]=2;Assert.False(MatchWire.TryDecodeClient(bytes,out _,out _,out _,out _));
            Assert.False(MatchWire.TryDecodeClient(new byte[257],out _,out _,out _,out _));
        }
        [Test] public void VerifiedMembershipOneUseAndReconnect(){
            var now=DateTimeOffset.UtcNow;var id=Guid.NewGuid();
            var service=new MatchGrantService(id,new AuthoritativeMatch(Draft(),1),()=>now);
            using(var loop=new MatchLoop()){
                var endpoint=new MatchSocketEndpoint(service,loop,new FakeVerifier());
                Assert.IsNull(Ticket(endpoint,loop,"invalid"));Assert.IsNull(Ticket(endpoint,loop,"outsider"));
                var token=Ticket(endpoint,loop,"valid");Assert.NotNull(token);
                Assert.IsNull(service.Redeem(Guid.NewGuid(),1,token));
                Assert.IsNull(service.Redeem(id,2,token));
                var first=service.Redeem(id,1,token);Assert.NotNull(first);
                Assert.IsNull(service.Redeem(id,1,token));
                var second=service.Redeem(id,1,Ticket(endpoint,loop,"valid"));Assert.NotNull(second);
                Assert.IsNull(service.Snapshot(first));Assert.False(service.Close(first));Assert.NotNull(service.Snapshot(second));
                now=now.AddSeconds(16);service.Sweep();Assert.IsNull(service.Snapshot(second));
                token=Ticket(endpoint,loop,"valid");now=now.AddSeconds(31);Assert.IsNull(service.Redeem(id,1,token));
            }
        }
        [Test] public void StalledLoopCancellationNeverExecutesExpiredWork(){
            using(var loop=new MatchLoop())using(var cancel=new CancellationTokenSource()){
                bool ran=false;var pending=loop.Invoke(()=>{ran=true;return 1;},cancel.Token);
                cancel.Cancel();Assert.ThrowsAsync<TaskCanceledException>(async()=>{await pending;});
                loop.Pump();Assert.False(ran);
            }
        }
        [Test] public void NoStartBeforeTenConnected(){
            var service=new MatchGrantService(Guid.NewGuid(),new AuthoritativeMatch(Draft(),1));
            using(var driver=new MatchServerDriver(new MatchLoop(),service))Assert.False(driver.StartMatch());
        }
    }
}
