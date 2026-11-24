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
        [Test] public void ProductionAndUpgradeCannotBypassWorkerAndPayment(){
            var b=new OfflineBattle("phan");var t=b.Units.First(u=>u.Team==ArenaTeam.Lux&&u.Kind==BattleTargetKind.Structure&&!u.Core);
            Assert.False(b.Deploy(ArenaTeam.Tenebra,ArenaLane.Top,1,1));
            Assert.False(b.UpgradeTower(ArenaTeam.Lux,1,.15f,.05f));
            Assert.AreEqual(340,t.State.MaxHealth,.001f);
            for(int i=0;i<60;i++)b.Advance(.1f,Vector2.zero);
            var enemy=b.Units.First(u=>u.Kind==BattleTargetKind.Minion&&u.Team==ArenaTeam.Tenebra);
            for(int i=0;i<10&&enemy.State.Alive;i++)Assert.True(b.Hit(b.Player.State,enemy.State,300));
            Assert.False(enemy.State.Alive);
            Assert.AreEqual(0,b.ReviveRecent(ArenaTeam.Tenebra,2,25,.6f));
            var village=b.GetVillage(ArenaTeam.Lux);var time=village.Time;var wood=village.Wood;
            village.Advance(500);
            Assert.AreEqual(time,village.Time);Assert.AreEqual(wood,village.Wood);
        }
        [Test] public void PhysicalPaidJobsStillRunThroughMatchClock(){
            var b=new OfflineBattle("phan");var village=b.GetVillage(ArenaTeam.Lux);
            Assert.True(b.OrderPlayerResource("lira",VillageResourceKind.Wood));
            for(int i=0;i<350;i++)b.Advance(.1f,Vector2.zero);
            Assert.Greater(village.Wood,0);
            Assert.Greater(village.Find("lira").Actions,0);
            Assert.False(b.Deploy(ArenaTeam.Lux,ArenaLane.Top,2,1));
            Assert.True(b.OrderPlayerResource("lira",VillageResourceKind.Food));
            for(int i=0;i<350;i++)b.Advance(.1f,Vector2.zero);
            Assert.Greater(village.Food,0);
        }
    }
}
