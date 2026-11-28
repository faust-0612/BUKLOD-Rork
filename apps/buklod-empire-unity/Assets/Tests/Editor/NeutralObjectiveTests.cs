using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public class NeutralObjectiveTests {
        [Test] public void JungleHazardsHaveMirroredTerritoriesAndNoCampIdentity(){
            var b=new OfflineBattle("phan");Assert.AreEqual(4,b.JungleHazards.Count);Assert.False(b.JungleHazardsActive);
            Assert.AreEqual(16,b.Camps.Count);
            Assert.AreEqual(new Vector2(OfflineBattle.Width,OfflineBattle.Height),b.JungleHazards[0].Home+b.JungleHazards[1].Home);
            Assert.AreEqual(new Vector2(OfflineBattle.Width,OfflineBattle.Height),b.JungleHazards[2].Home+b.JungleHazards[3].Home);
        }
        [Test] public void VenomBudgetIsBoundedPerApplication(){
            Assert.AreEqual(3,OfflineBattle.VenomTicks);
            Assert.AreEqual(.06f,OfflineBattle.VenomTicks*OfflineBattle.VenomTickFraction,.0001f);
        }
        [Test] public void HazardSegmentDetectsCrossingEvenWhenEndpointsAreSafe(){
            Assert.AreEqual(-5f,OfflineBattle.HazardSegmentClearance(Vector2.left*10,Vector2.right*10,Vector2.zero,5),.0001f);
            Assert.AreEqual(1f,OfflineBattle.HazardSegmentClearance(new Vector2(-10,6),new Vector2(10,6),Vector2.zero,5),.0001f);
            Assert.AreEqual(5f,OfflineBattle.HazardSegmentClearance(Vector2.right*10,Vector2.right*10,Vector2.zero,5),.0001f);
        }
        [Test] public void HazardRangeIncludesBoundary(){
            Assert.True(OfflineBattle.InHazardRange(Vector2.right*10,Vector2.zero,10));
            Assert.False(OfflineBattle.InHazardRange(Vector2.right*10.1f,Vector2.zero,10));
        }
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
        [Test] public void PresentationSequencesOnlyAdvanceForAcceptedCombat(){
            var d=new NeutralObjectiveDirector();d.Advance(120);
            var c=d.Camps.Single(x=>x.Kind==WildernessKind.AncientSentinel);
            Assert.AreEqual(0,c.HitSequence);Assert.AreEqual(0,c.AttackSequence);Assert.AreEqual(0,c.DefeatSequence);
            Assert.False(d.TryHit(c.Id,1,Vector2.zero,1,20,out _));
            Assert.AreEqual(0,c.HitSequence);
            Assert.True(d.TryHit(c.Id,1,c.Position,3,30,out _));Assert.AreEqual(1,c.HitSequence);
            Assert.False(d.TryRetaliate(c.Id,1,c.Position,out _));Assert.AreEqual(0,c.AttackSequence);
            d.Advance(121.3f);var position=c.Position+Vector2.right;
            Assert.True(d.TryRetaliate(c.Id,1,position,out _));Assert.AreEqual(1,c.AttackSequence);Assert.AreEqual(position,c.LastAttackPosition);
            Assert.False(d.TryRetaliate(c.Id,1,position,out _));Assert.AreEqual(1,c.AttackSequence);
            Assert.True(d.TryHit(c.Id,1,c.Position,3,400,out bool defeated));Assert.False(defeated);
            Assert.True(d.TryHit(c.Id,1,c.Position,3,400,out defeated));Assert.True(defeated);
            Assert.AreEqual(3,c.HitSequence);Assert.AreEqual(1,c.DefeatSequence);
            Assert.False(d.TryHit(c.Id,1,c.Position,3,400,out _));Assert.AreEqual(1,c.DefeatSequence);
            d.Advance(272);Assert.True(c.Alive);Assert.AreEqual(1,c.DefeatSequence);
            d.Advance(900);Assert.False(c.Alive);Assert.AreEqual(1,c.DefeatSequence);
        }
        [Test] public void FieldVisibilityUsesTeamVisionAndRejectsInvalidCoordinates(){
            var b=new OfflineBattle("phan");var foe=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            Assert.True(b.IsPositionVisibleTo(ArenaTeam.Lux,b.Player.Position));Assert.False(b.IsPositionVisibleTo(ArenaTeam.Lux,foe.Position));
            Assert.False(b.IsPositionVisibleTo(ArenaTeam.Lux,new Vector2(float.NaN,0)));Assert.False(b.IsPositionVisibleTo((ArenaTeam)999,b.Player.Position));
        }
        [Test] public void OppositeBaseIsHiddenAtMatchStartAndCampsNotFactionUnits(){
            var b=new OfflineBattle("phan");var enemy=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            Assert.False(b.IsVisibleTo(ArenaTeam.Lux,enemy));Assert.True(b.IsVisibleTo(ArenaTeam.Tenebra,enemy));
            Assert.AreEqual(15,b.RemainingUnits(ArenaTeam.Lux));Assert.False(b.AttackNeutralPlayer(1));
        }
    }
}
