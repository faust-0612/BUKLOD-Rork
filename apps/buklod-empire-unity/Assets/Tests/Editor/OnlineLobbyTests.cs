using System;
using System.Linq;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class OnlineLobbyTests {
        static OnlineLobbyDirectory Directory()=>new OnlineLobbyDirectory(new[]{"ph","sg"});
        [Test] public void PrivateInviteIsTargetedAndTeamCapacityIsBounded(){
            var d=Directory();var id=d.CreatePrivate("owner","ph",OnlineMode.Casual);
            Assert.AreNotEqual(Guid.Empty,id);Assert.False(d.JoinPrivate(id,"other",ArenaTeam.Lux));
            Assert.False(d.Invite(id,"other","p1"));Assert.True(d.Invite(id,"owner","p1"));Assert.True(d.JoinPrivate(id,"p1",ArenaTeam.Tenebra));
            Assert.False(d.JoinPrivate(id,"p1",ArenaTeam.Tenebra));Assert.IsNull(d.Snapshot(id,"other"));Assert.False(d.Enqueue("p1","ph",OnlineMode.Casual));
        }
        [Test] public void QueueSeparatesRegionAndModeAndDraftRejectsDuplicates(){
            var d=Directory();for(int i=0;i<9;i++)Assert.True(d.Enqueue("p"+i,"ph",OnlineMode.Casual));
            Assert.True(d.Enqueue("ranked","ph",OnlineMode.Ranked));Assert.True(d.Enqueue("region","sg",OnlineMode.Casual));
            Assert.AreEqual(Guid.Empty,d.FormQueued("ph",OnlineMode.Casual));Assert.True(d.Enqueue("p9","ph",OnlineMode.Casual));
            var id=d.FormQueued("ph",OnlineMode.Casual);var snap=d.Snapshot(id,"p0");
            Assert.AreEqual(5,snap.Members.Count(x=>x.Team==ArenaTeam.Lux));Assert.AreEqual(5,snap.Members.Count(x=>x.Team==ArenaTeam.Tenebra));
            Assert.False(d.Pick(id,"p0","phan"));Assert.True(d.Ban(id,"p0","trudice"));Assert.False(d.Ban(id,"p1","trudice"));Assert.True(d.Ban(id,"p1",null));
            var heroes=HeroKitCatalog.All.Where(h=>h.Id!="trudice").Take(10).ToArray();
            for(int i=0;i<10;i++){if(i>0)Assert.False(d.Pick(id,"p"+i,heroes[0].Id));Assert.True(d.Pick(id,"p"+i,heroes[i].Id));}
            Assert.IsNull(d.LockDraft(id,"p1"));Assert.NotNull(d.LockDraft(id,"p0"));
            Assert.AreEqual(LobbyPhase.ReservationPending,d.Snapshot(id,"p0").Phase);Assert.False(d.Leave(id,"p0"));Assert.IsNull(d.LockDraft(id,"p0"));
        }
        [Test] public void ExpirationReleasesUnreservedMembership(){
            var now=DateTimeOffset.UtcNow;var d=new OnlineLobbyDirectory(new[]{"ph"},()=>now);
            var id=d.CreatePrivate("owner","ph",OnlineMode.Casual);Assert.True(d.Invite(id,"owner","p1"));now=now.AddMinutes(3);
            Assert.False(d.JoinPrivate(id,"p1",ArenaTeam.Tenebra));now=now.AddMinutes(3);
            Assert.AreEqual(Guid.Empty,d.RoomFor("owner"));Assert.True(d.Enqueue("owner","ph",OnlineMode.Casual));
        }
    }
}
