using System.Collections;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
namespace Buklod.Empire.Tests {
    public sealed class RuntimeBattleSmokeTests {
        [UnityTest] public IEnumerator EveryHeroStartsAnIndependentOfflineMatch(){
            foreach(var kit in HeroKitCatalog.All){
                var battle=new OfflineBattle(kit.Id);
                Assert.AreEqual(kit.Id,battle.Player.State.Kit.Id);
                Assert.AreEqual(10,battle.Units.Count(u=>u.Kind==BattleTargetKind.Hero));
                Assert.AreEqual(12,battle.Units.Count(u=>u.Kind==BattleTargetKind.Villager));
                Assert.AreEqual(0,battle.Time);
                battle.Advance(.1f,Vector2.right);
                Assert.AreEqual(.1f,battle.Time,.001f);
                Assert.False(battle.Finished);
                yield return null;
            }
        }
        [UnityTest] public IEnumerator ConfiguredOfflineSessionRetainsItsLoadoutAndResetsEconomy(){
            var b=new OfflineBattle("quin",seed:8,difficulty:ArenaDifficulty.Expert,autonomousTraining:false);
            Assert.True(b.SelectPlayerTactic(ArenaTactic.CleansingLight));Assert.True(b.SelectPlayerCovenant(CovenantPaths.DefaultFor("quin")));
            Assert.AreEqual(ArenaTactic.CleansingLight,b.Player.Tactic);Assert.True(b.Player.Covenant.HasValue);
            Assert.True(b.OrderPlayerResource("lira",VillageResourceKind.Gold));Assert.False(b.OrderPlayerResource("velin",VillageResourceKind.Gold));
            b.Advance(.1f,Vector2.zero);Assert.False(b.SelectPlayerTactic(ArenaTactic.Renew));
            var next=new OfflineBattle("phan");Assert.AreEqual(0,next.GetVillage(ArenaTeam.Lux).Gold);Assert.AreEqual(6,next.PaidTroopCapacity(ArenaTeam.Lux));Assert.AreEqual(ArenaTactic.Renew,next.Player.Tactic);
            yield return null;
        }
        [UnityTest] public IEnumerator AutonomousEarlyMatchMaintainsBoundedEconomyAndUnits(){
            var b=new OfflineBattle("phan",seed:19,difficulty:ArenaDifficulty.Advanced,autonomousTraining:true);
            for(int i=0;i<1200&&!b.Finished;i++){
                b.Advance(.1f,Vector2.zero);
                if(i%100==0){foreach(var team in new[]{ArenaTeam.Lux,ArenaTeam.Tenebra}){var v=b.GetVillage(team);Assert.That(v.Wood,Is.InRange(0,10000));Assert.That(v.Food,Is.InRange(0,10000));Assert.That(b.Units.Count(u=>u.Team==team&&u.Kind==BattleTargetKind.Minion&&u.State.Alive),Is.LessThanOrEqualTo(OfflineBattle.FactionMinionLimit));}
                    Assert.That(b.Drops.Count,Is.LessThanOrEqualTo(ArenaPickupCatalog.Limit));Assert.That(b.RelicDrops.Count,Is.LessThanOrEqualTo(ArenaRelicCatalog.GroundLimit));yield return null;}
            }
            if(b.Finished&&b.Winner.HasValue)Assert.AreEqual(0,b.RemainingUnits(b.Winner.Value==ArenaTeam.Lux?ArenaTeam.Tenebra:ArenaTeam.Lux));
        }
        [UnityTest] public IEnumerator RejectedSkillAndInvalidMovementStaySafe(){
            var battle=new OfflineBattle("phan");
            var before=battle.Player.Position;
            Assert.False(battle.CastPlayer(SkillSlot.Ultimate,Vector2.right));
            Assert.AreEqual(100,battle.Player.State.Mana);
            battle.Advance(.1f,new Vector2(float.NaN,0));
            Assert.AreEqual(before,battle.Player.Position);
            yield return null;
        }
    }
}
