using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public class NeutralObjectiveTests {
        [Test] public void MirroredCampsAndTimedBossesSpawnOnce(){
            var d=new NeutralObjectiveDirector();Assert.AreEqual(16,d.Camps.Count);Assert.False(d.Camps.Any(c=>c.Alive));
            d.Advance(20);Assert.AreEqual(14,d.Camps.Count(c=>c.Alive));d.Advance(120);Assert.AreEqual(15,d.Camps.Count(c=>c.Alive));d.Advance(480);Assert.AreEqual(16,d.Camps.Count(c=>c.Alive));
            d.Advance(900);Assert.False(d.Camps.Any(c=>c.Alive));
        }
        [Test] public void LeashAndRespawnNeverDuplicateObjectiveKill(){
            var d=new NeutralObjectiveDirector();d.Advance(20);var c=d.Camps[0];Assert.False(d.TryHit(c.Id,1,Vector2.zero,2,400,out _));
            Assert.True(d.TryHit(c.Id,1,c.Position,3,30,out bool defeated));Assert.False(defeated);Assert.AreEqual(c.MaxHealth-30,c.Health);
            d.Advance(21.3f);Assert.True(d.TryRetaliate(c.Id,1,c.Position,out float damage));Assert.Greater(damage,0);Assert.False(d.TryRetaliate(c.Id,1,c.Position,out _));
            d.Advance(27);Assert.AreEqual(c.MaxHealth,c.Health);Assert.True(d.TryHit(c.Id,1,c.Position,3,400,out defeated));Assert.True(defeated);
            Assert.False(d.TryHit(c.Id,2,c.Position,3,400,out _));d.Advance(86);Assert.False(c.Alive);d.Advance(87);Assert.True(c.Alive);
        }
        [Test] public void OppositeBaseIsHiddenAtMatchStartAndCampsNotFactionUnits(){
            var b=new OfflineBattle("phan");var enemy=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            Assert.False(b.IsVisibleTo(ArenaTeam.Lux,enemy));Assert.True(b.IsVisibleTo(ArenaTeam.Tenebra,enemy));
            Assert.AreEqual(15,b.RemainingUnits(ArenaTeam.Lux));Assert.False(b.AttackNeutralPlayer(1));
        }
    }
}
