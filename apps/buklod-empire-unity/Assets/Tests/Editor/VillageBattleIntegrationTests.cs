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
        [Test] public void PopulationAndRecruitmentDoNotBypassHousingOrFunds(){
            var b=new OfflineBattle("phan");Assert.AreEqual(12,b.PopulationCapacity(ArenaTeam.Lux));Assert.AreEqual(6,b.PopulationUsed(ArenaTeam.Lux));
            Assert.False(b.RecruitPlayerGatherer());Assert.False(b.RecruitmentPending(ArenaTeam.Lux));Assert.False(b.CancelPlayerRecruitment());
            Assert.False(b.OrderPlayerConstruction(VillageBuildOrder.House,new Vector2(22,100)));
            Assert.AreEqual(0,b.PopulationCapacity((ArenaTeam)999));Assert.AreEqual(0,b.PopulationUsed((ArenaTeam)999));
            for(int i=0;i<100;i++)b.Advance(.1f,Vector2.zero);
            Assert.AreEqual(6,b.PopulationUsed(ArenaTeam.Lux));Assert.False(b.RecruitPlayerGatherer());
        }
        [Test] public void MarketCannotMintOrSpendWithoutFunding(){
            var b=new OfflineBattle("phan");
            Assert.False(b.ExchangePlayerResource(VillageResourceKind.Wood,true));
            Assert.False(b.ExchangePlayerResource(VillageResourceKind.Food,false));
            Assert.False(b.ExchangePlayerResource(VillageResourceKind.Gold,true));
            Assert.AreEqual(0,b.MarketReadyAt);
            Assert.True(b.OrderPlayerResource("lira",VillageResourceKind.Gold));
            for(int i=0;i<550;i++)b.Advance(.1f,Vector2.zero);
            var bank=b.GetVillage(ArenaTeam.Lux);Assert.GreaterOrEqual(bank.Gold,24);
            var before=bank.Gold;var wood=bank.Wood;
            Assert.True(b.ExchangePlayerResource(VillageResourceKind.Wood,true));Assert.AreEqual(before-24,bank.Gold,.001);Assert.AreEqual(wood+20,bank.Wood,.001);
            Assert.False(b.ExchangePlayerResource(VillageResourceKind.Wood,false));
            for(int i=0;i<101;i++)b.Advance(.1f,Vector2.zero);
            before=bank.Gold;wood=bank.Wood;Assert.True(b.ExchangePlayerResource(VillageResourceKind.Wood,false));
            Assert.AreEqual(before+12,bank.Gold,.001);Assert.AreEqual(wood-20,bank.Wood,.001);
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
