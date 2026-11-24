using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class OfflineBattleTests {
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
