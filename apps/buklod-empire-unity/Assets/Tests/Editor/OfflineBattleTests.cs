using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class OfflineBattleTests {
        [Test] public void EveryHeroCanBePickedWithoutDuplicatingTeammates(){
            foreach(var kit in HeroKitCatalog.All){
                var b=new OfflineBattle(kit.Id);
                Assert.AreEqual(kit.Id,b.Player.State.Kit.Id);
                foreach(var team in new[]{ArenaTeam.Lux,ArenaTeam.Tenebra}){
                    var ids=b.Units.Where(u=>u.Team==team&&u.Kind==BattleTargetKind.Hero).Select(u=>u.State.Kit.Id).ToArray();
                    Assert.AreEqual(5,ids.Length);
                    Assert.AreEqual(5,ids.Distinct().Count(),kit.Id+" / "+team);
                }
            }
        }
        [Test] public void TimeoutPrioritizesSurvivingTowersThenCoreRatio(){
            Assert.AreEqual(ArenaTeam.Lux,OfflineBattle.ResolveTimeout(3,2,.1f,.9f));
            Assert.AreEqual(ArenaTeam.Tenebra,OfflineBattle.ResolveTimeout(1,1,.4f,.8f));
            Assert.IsNull(OfflineBattle.ResolveTimeout(2,2,.6f,.6f));
        }
        [Test] public void StartingNewBattleDoesNotCarryMatchLocalGoldOrGear(){
            var b=new OfflineBattle("phan");
            Assert.True(b.BuyPlayer("blade"));
            var next=new OfflineBattle("quin");
            Assert.AreEqual(120,next.Player.Gold);
            Assert.IsEmpty(next.Player.Gear);
            Assert.AreEqual(0,next.Time);
        }
        [Test] public void StartsFiveVersusFiveAndProtectsCores(){
            var b=new OfflineBattle("phan");
            Assert.AreEqual(5,b.Units.Count(u=>u.Kind==BattleTargetKind.Hero&&u.Team==ArenaTeam.Lux));
            Assert.AreEqual(5,b.Units.Count(u=>u.Kind==BattleTargetKind.Hero&&u.Team==ArenaTeam.Tenebra));
            var core=b.Units.Single(u=>u.Core&&u.Team==ArenaTeam.Tenebra);
            Assert.False(b.Hit(b.Player.State,core.State,100));
            var tower=b.Units.First(u=>u.Kind==BattleTargetKind.Structure&&u.Team==ArenaTeam.Tenebra&&!u.Core);
            Assert.True(b.Hit(b.Player.State,tower.State,300));Assert.True(b.Hit(b.Player.State,tower.State,100));
            Assert.True(b.Hit(b.Player.State,core.State,300));Assert.True(b.Hit(b.Player.State,core.State,300));
            Assert.True(b.Finished);Assert.AreEqual(ArenaTeam.Lux,b.Winner);
            Assert.False(b.PlayerAttack(Vector2.right));
        }
        [Test] public void WavesAndMovementAreDrivenByMatchClock(){
            var b=new OfflineBattle("phan");var start=b.Player.Position;
            for(int i=0;i<60;i++)b.Advance(.1f,Vector2.right);
            Assert.Greater(b.Player.Position.x,start.x);
            Assert.Greater(b.Units.Count(u=>u.Kind==BattleTargetKind.Minion),0);
            Assert.AreEqual(6,b.Time,.001f);
        }
        [Test] public void ShopAndRejectedSkillKeepMatchStateConsistent(){
            var b=new OfflineBattle("phan");
            Assert.True(b.BuyPlayer("blade"));Assert.AreEqual(0,b.Player.Gold);
            Assert.False(b.BuyPlayer("blade"));Assert.False(b.CastPlayer(SkillSlot.Primary,Vector2.right));
            Assert.AreEqual(100,b.Player.State.Mana);
        }
    }
}
