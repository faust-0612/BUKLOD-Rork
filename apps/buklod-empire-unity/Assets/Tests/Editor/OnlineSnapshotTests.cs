using System;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class OnlineSnapshotTests {
        static AuthoritativeMatch Match()=>new AuthoritativeMatch(HeroKitCatalog.All.Take(10).Select((h,i)=>new ArenaDraftPick("p"+i,h.Id,i<5?ArenaTeam.Lux:ArenaTeam.Tenebra)).ToArray(),11);
        [Test] public void FullSnapshotRoundTripAndBounds(){
            var m=Match();var session=m.OpenSession("p0");var expected=m.Snapshot(session);var bytes=MatchWire.EncodeSnapshot(expected);
            Assert.True(MatchWire.TryDecodeSnapshot(bytes,out var actual));
            Assert.AreEqual(expected.OwnUnitId,actual.OwnUnitId);Assert.AreEqual(expected.Team,actual.Team);Assert.AreEqual(expected.Units.Count,actual.Units.Count);
            CollectionAssert.AreEqual(expected.Units.Select(u=>u.Position),actual.Units.Select(u=>u.Position));
            CollectionAssert.AreEqual(expected.TeamBalances,actual.TeamBalances);
            Assert.False(MatchWire.TryDecodeSnapshot(bytes.Concat(new byte[]{0}).ToArray(),out _));
            Assert.False(MatchWire.TryDecodeSnapshot(bytes.Take(bytes.Length-1).ToArray(),out _));
            Assert.False(MatchWire.TryDecodeSnapshot(new byte[65537],out _));
        }
        [Test] public void TimelineRejectsWrongIdentityAndResetsOnReconnect(){
            var m=Match();var s=m.OpenSession("p0");var other=m.OpenSession("p5");var timeline=new OnlineTimeline();
            Assert.True(MatchWire.TryDecodeSnapshot(MatchWire.EncodeSnapshot(m.Snapshot(s)),out var a));
            Assert.True(timeline.Accept(a));Assert.False(timeline.Accept(a));
            Assert.True(MatchWire.TryDecodeSnapshot(MatchWire.EncodeSnapshot(m.Snapshot(other)),out var b));Assert.False(timeline.Accept(b));
            Assert.True(timeline.TryPosition(a.OwnUnitId,1,out _));timeline.Disconnect();Assert.False(timeline.TryPosition(a.OwnUnitId,1,out _));
            Assert.True(timeline.Accept(a));Assert.True(timeline.TryPosition(a.OwnUnitId,0,out _));
        }
    }
}
