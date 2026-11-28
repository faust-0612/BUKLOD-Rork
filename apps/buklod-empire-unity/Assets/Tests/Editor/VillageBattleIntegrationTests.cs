using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class VillageBattleIntegrationTests {
        [Test] public void OfflineMilitaryOrdersAreValidatedAndDoNotChangeWaveRoles(){
            var b=new OfflineBattle("phan");
            Assert.True(b.OrderPlayerMilitaryRole(MinionRole.Mage));
            Assert.AreEqual(MinionRole.Mage,b.PlayerMilitaryRole);
            Assert.True(b.OrderPlayerArmy(VillageArmyOrder.GuardBase));
            Assert.False(b.OrderPlayerArmy((VillageArmyOrder)999));
            Assert.False(b.OrderPlayerMilitaryRole((MinionRole)999));
            Assert.AreEqual(0,b.PaidTroops(ArenaTeam.Lux));
        }
        [Test] public void OfflineRelicsAreStoredAndEquippedOnlyThroughVault(){
            var b=new OfflineBattle("phan");
            var field=(System.Collections.Generic.List<ArenaRelicDrop>)typeof(OfflineBattle).GetField("relicDrops",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).GetValue(b);
            var item=new ArenaRelicDefinition("test","phan","weapon","Test blade","test",1,1,false,new ArenaRelicStats{Attack=5});
            field.Add(new ArenaRelicDrop(123,item,b.Player.Position,b.Time));
            b.Advance(.1f,Vector2.zero);
            Assert.AreEqual(1,field.Count,"Human offline loot remains on ground until explicitly collected.");
            Assert.True(b.CollectPlayerRelic(123));Assert.False(b.CollectPlayerRelic(123));
            Assert.AreEqual(1,b.PracticeVault.Count);Assert.AreEqual(0,b.Player.Relics.Count);
            Assert.True(b.EquipPracticeVault(0));Assert.AreEqual(0,b.PracticeVault.Count);Assert.AreSame(item,b.Player.Relics["weapon"]);
            Assert.False(b.EquipPracticeVault(0));
        }
        [Test] public void WarehousePersistsCanonicalItemsAcrossInstances(){
            string key="buklod.test.warehouse."+System.Guid.NewGuid().ToString("N");
            try{
                Assert.True(ArenaRelicCatalog.TryGet("phan-weapon-t1",out var item));
                var bank=new OfflinePracticeWarehouse(key);Assert.True(bank.TryDeposit(item));
                var reopened=new OfflinePracticeWarehouse(key);Assert.AreEqual(1,reopened.Items.Count);
                Assert.True(reopened.TryWithdraw(0,out var restored));Assert.AreSame(item,restored);
                Assert.AreEqual(0,new OfflinePracticeWarehouse(key).Items.Count);
            }finally{PlayerPrefs.DeleteKey(key);PlayerPrefs.Save();}
        }
        [Test] public void CreatureContractsAndIndividualOrdersRejectUnownedTargets(){
            var b=new OfflineBattle("phan");Assert.False(b.OrderPlayerCreature(WildernessKind.StoneGolem));
            Assert.False(b.OrderPlayerSoldier(b.Player.Id,VillageArmyOrder.HoldPosition));
            Assert.False(b.OrderPlayerSoldierMove(b.Player.Id,b.Player.Position));
            Assert.AreEqual(MinionRole.Siege,OfflineBattle.CreatureRole(WildernessKind.StoneGolem));
            Assert.AreEqual(MinionRole.Healer,OfflineBattle.CreatureRole(WildernessKind.AzureStag));
        }
        [Test] public void TwelveCanonicalVillagersAndDamageSync(){
            var b=new OfflineBattle("phan");var villagers=b.Units.Where(u=>u.Kind==BattleTargetKind.Villager).ToArray();
            Assert.AreEqual(12,villagers.Length);Assert.AreEqual(12,villagers.Select(u=>u.Villager.Job.Id).Distinct().Count());
            var enemy=villagers.First(u=>u.Team==ArenaTeam.Tenebra);
            Assert.True(b.Hit(b.Player.State,enemy.State,50));Assert.AreEqual(150,enemy.State.Health);Assert.AreEqual(150,enemy.Villager.Health);
        }
        // Set up a deterministic encounter without spending minutes walking across the map.
        static void Place(BattleUnit unit,Vector2 point){
            typeof(BattleUnit).GetProperty(nameof(BattleUnit.Position)).SetValue(unit,point);
        }
        [Test] public void WorkerRetaliatesOnlyAfterDamageAndRespectsCooldown(){
            var b=new OfflineBattle("phan");
            var worker=b.Units.First(u=>u.Villager?.Job.Id=="velin");
            Place(b.Player,worker.Position+new Vector2(0,1.5f));
            b.Advance(.1f,Vector2.zero);
            Assert.AreEqual(float.NegativeInfinity,worker.LastAttack,"No unprovoked attacks.");
            Assert.True(b.Hit(b.Player.State,worker.State,5));
            b.Advance(.1f,Vector2.zero);
            Assert.Greater(worker.LastAttack,0,"A threatened worker must fight back.");
            Assert.Greater(Vector2.Dot(worker.AttackFacing,(b.Player.Position-worker.Position).normalized),.99f);
            var stamp=worker.LastAttack;
            b.Advance(.1f,Vector2.zero);
            Assert.AreEqual(stamp,worker.LastAttack,"Retaliation must honor cooldown.");
        }
        [Test] public void DistantAttackerDoesNotPullGathererAwayFromJob(){
            var b=new OfflineBattle("phan");
            var worker=b.Units.First(u=>u.Villager?.Job.Id=="velin");
            Assert.True(b.Hit(b.Player.State,worker.State,5));
            var start=worker.Position;
            b.Advance(.1f,Vector2.zero);
            Assert.AreEqual(float.NegativeInfinity,worker.LastAttack);
            Assert.Less(Vector2.Distance(start,worker.Position),1f);
            Assert.AreEqual(VillageWorkerOrder.Gather,worker.WorkerOrder);
        }
        [Test] public void NaturalDepositsAreCapturableButFoodPlotsAreNot(){
            var b=new OfflineBattle("phan");
            Assert.AreEqual(8,b.ResourceNodes.Count(n=>n.Capturable));Assert.AreEqual(2,b.ResourceNodes.Count(n=>!n.Capturable));
            Assert.True(b.ResourceNodes.All(n=>n.CaptureProgress==0));
            for(int i=0;i<100;i++)b.Advance(.1f,Vector2.zero);
            Assert.True(b.ResourceNodes.All(n=>n.Stock<=n.Capacity&&n.Stock>=0));
            Assert.False(b.Finished);Assert.AreEqual("",b.EndReason);
        }
        [Test] public void PopulationAndRecruitmentDoNotBypassHousingOrFunds(){
            var b=new OfflineBattle("phan");Assert.AreEqual(12,b.PopulationCapacity(ArenaTeam.Lux));Assert.AreEqual(6,b.PopulationUsed(ArenaTeam.Lux));
            Assert.False(b.RecruitPlayerGatherer());Assert.False(b.RecruitmentPending(ArenaTeam.Lux));Assert.False(b.CancelPlayerRecruitment());
            Assert.False(b.OrderPlayerConstruction(VillageBuildOrder.House,new Vector2(22,100)));
            Assert.AreEqual(0,b.PopulationCapacity((ArenaTeam)999));Assert.AreEqual(0,b.PopulationUsed((ArenaTeam)999));
            for(int i=0;i<100;i++)b.Advance(.1f,Vector2.zero);
            Assert.AreEqual(6,b.PopulationUsed(ArenaTeam.Lux));Assert.False(b.RecruitPlayerGatherer());
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
