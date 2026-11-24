using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class VillageBattleIntegrationTests {
        [Test] public void TwelveCanonicalVillagersAndDamageSync(){
            var b=new OfflineBattle("phan");var villagers=b.Units.Where(u=>u.Kind==BattleTargetKind.Villager).ToArray();
            Assert.AreEqual(12,villagers.Length);Assert.AreEqual(12,villagers.Select(u=>u.Villager.Job.Id).Distinct().Count());
            var enemy=villagers.First(u=>u.Team==ArenaTeam.Tenebra);
            Assert.True(b.Hit(b.Player.State,enemy.State,50));Assert.AreEqual(150,enemy.State.Health);Assert.AreEqual(150,enemy.Villager.Health);
        }
        [Test] public void DeploymentRevivalAndTowerUpgradeUseMatchLocalState(){
            var b=new OfflineBattle("phan");
            Assert.True(b.Deploy(ArenaTeam.Tenebra,ArenaLane.Top,1,1));
            var enemy=b.Units.Single(u=>u.Kind==BattleTargetKind.Minion);
            Assert.True(b.Hit(b.Player.State,enemy.State,300));Assert.True(b.Hit(b.Player.State,enemy.State,300));
            Assert.AreEqual(1,b.ReviveRecent(ArenaTeam.Tenebra,2,25,.6f));
            Assert.AreEqual(0,b.ReviveRecent(ArenaTeam.Tenebra,2,25,.6f));
            var t=b.Units.First(u=>u.Team==ArenaTeam.Lux&&u.Kind==BattleTargetKind.Structure&&!u.Core);
            Assert.True(b.UpgradeTower(ArenaTeam.Lux,1,.15f,.05f));Assert.AreEqual(2,t.TowerLevel);Assert.AreEqual(391,t.State.MaxHealth,.001f);
        }
    }
}
