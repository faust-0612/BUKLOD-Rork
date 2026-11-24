using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class OfflineBattleTests {
        [Test] public void CovenantLoadoutIsFreeMatchLocalAndCannotStackOnReselect(){
            var b=new OfflineBattle("phan");var pick=new CovenantLoadout(CovenantPath.Courage,CovenantTalent.Fortitude,CovenantTalent.Resolve,CovenantTalent.Sustenance);
            Assert.True(b.SelectPlayerCovenant(pick));Assert.AreEqual(185,b.Player.State.MaxHealth);Assert.AreEqual(120,b.Player.Gold);
            Assert.True(b.SelectPlayerCovenant(pick));Assert.AreEqual(185,b.Player.State.MaxHealth);
            Assert.True(b.Units.Where(x=>x.Kind==BattleTargetKind.Hero).All(x=>x.Covenant.HasValue));
            Assert.False(b.SelectPlayerCovenant(new CovenantLoadout(CovenantPath.Courage,CovenantTalent.Focus,CovenantTalent.Focus,CovenantTalent.Sustenance)));
            b.Advance(.1f,Vector2.zero);Assert.False(b.SelectPlayerCovenant(pick));Assert.IsNull(new OfflineBattle("phan").Player.Covenant);
        }
        [Test] public void AutonomousTrainingAndTargetLockUseNormalRules(){
            var b=new OfflineBattle("phan",seed:9,difficulty:ArenaDifficulty.Expert,autonomousTraining:true);
            var start=b.Player.Position;Assert.AreEqual(ArenaDifficulty.Expert,b.Difficulty);Assert.True(b.AutonomousTraining);
            var foe=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            Assert.False(b.PlayerAttackUnit(foe.Id));Assert.False(b.PlayerAttackUnit(b.Player.Id));Assert.False(b.PlayerAttackUnit(-1));
            for(int i=0;i<30;i++)b.Advance(.1f,Vector2.zero);
            Assert.Greater(Vector2.Distance(start,b.Player.Position),0);Assert.False(b.Finished);
        }
        [Test] public void ConstructionRejectsUnfundedInvalidAndEnemyOrders(){
            var b=new OfflineBattle("phan");var enemy=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Structure);
            Assert.False(b.OrderPlayerConstruction(VillageBuildOrder.Depot,new Vector2(22,100)));
            Assert.False(b.OrderPlayerConstruction(VillageBuildOrder.GuardPost,new Vector2(float.NaN,100)));
            Assert.False(b.OrderPlayerRepair(enemy.Id));Assert.False(b.CancelPlayerConstruction());
            Assert.AreEqual(15,b.RemainingUnits(ArenaTeam.Lux));
        }
        [Test] public void TemporaryTurretKillDoesNotMintIncomeAndInvalidSpawnsFail(){
            var b=new OfflineBattle("phan");var enemy=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            Assert.False(b.Turret(enemy.State,Vector2.left,3,float.NaN,8,11));
            Assert.True(b.Turret(enemy.State,Vector2.left,3,55,8,11));
            var summon=b.Units.Single(u=>u.Temporary);int gold=b.Player.Gold;float xp=b.Player.Xp;
            Assert.True(b.Hit(b.Player.State,summon.State,300));Assert.AreEqual(gold,b.Player.Gold);Assert.AreEqual(xp,b.Player.Xp);
            Assert.False(b.Dash(b.Player.State,Vector2.right,float.PositiveInfinity));
        }
        [Test] public void ArmyOrdersAreMatchLocalBoundedAndValidateTargets(){
            var b=new OfflineBattle("phan");Assert.AreEqual(ArmyOrder.Automatic,b.GetArmyCommand(ArenaTeam.Lux).Order);
            Assert.False(b.OrderPlayerArmy(ArmyOrder.Capture,ArmyFormation.Wedge,ArenaLane.Mid,999));
            Assert.False(b.OrderPlayerArmy(ArmyOrder.Escort,ArmyFormation.Screen));
            Assert.True(b.OrderPlayerArmy(ArmyOrder.Rally,ArmyFormation.Wedge));Assert.AreEqual(ArmyOrder.Rally,b.GetArmyCommand(ArenaTeam.Lux).Order);
            Assert.AreEqual(35,b.GetArmyCommand(ArenaTeam.Lux).ExpiresAt);Assert.False(b.OrderPlayerArmy(ArmyOrder.Defend,ArmyFormation.Line));
            Assert.True(b.OrderPlayerArmy(ArmyOrder.Automatic,ArmyFormation.Line));Assert.AreEqual(ArmyOrder.Automatic,b.GetArmyCommand(ArenaTeam.Lux).Order);
            Assert.AreEqual(ArmyOrder.Automatic,new OfflineBattle("phan").GetArmyCommand(ArenaTeam.Lux).Order);
        }
        [Test] public void CaravanModeIsOwnedWorkerOnlyAndDoesNotCreateCargo(){
            var b=new OfflineBattle("phan");var worker=b.Units.Single(u=>u.Villager?.Job.Id=="lira");
            Assert.True(worker.CaravanEnabled);Assert.False(b.TogglePlayerCaravan("velin"));Assert.False(b.TogglePlayerCaravan("unknown"));
            Assert.True(b.TogglePlayerCaravan("lira"));Assert.False(worker.CaravanEnabled);
            Assert.True(b.TogglePlayerCaravan("lira"));Assert.True(worker.CaravanEnabled);
            Assert.AreEqual(0,b.ActiveCaravans(ArenaTeam.Lux));Assert.AreEqual(0,b.CaravanDeliveredResources(ArenaTeam.Lux));Assert.AreEqual(0,b.CaravanLostResources(ArenaTeam.Lux));
        }
        [Test] public void TechnologyStartsAtZeroAndRejectsUnfundedOrders(){
            var b=new OfflineBattle("phan");var bank=b.GetVillage(ArenaTeam.Lux);
            foreach(VillageTechnology tech in System.Enum.GetValues(typeof(VillageTechnology))){
                Assert.AreEqual(0,bank.TechnologyTier(tech));Assert.False(b.ResearchPlayerTechnology(tech));
            }
            Assert.False(b.ResearchPlayerTechnology((VillageTechnology)999));Assert.IsNull(b.PendingTechnology(ArenaTeam.Lux));
            Assert.AreEqual(36,b.CargoCapacity(ArenaTeam.Lux));Assert.False(b.CancelPlayerTechnology());
        }
        [Test] public void NeutralTerritoryRequiresUncontestedHeroAndCannotGrantFreeResources(){
            var b=new OfflineBattle("phan");
            Assert.False(b.OrderPlayerTerritoryWorker("lira",1));
            var site=b.Territories[0];var node=b.ResourceNodes.Single(n=>n.Territory==site);double stock=node.Stock;
            Assert.IsNull(site.Owner);Assert.AreEqual(stock,node.Stock);
            Assert.False(b.OrderPlayerTerritoryWorker("velin",1));
            Assert.False(b.OrderPlayerTerritoryWorker("lira",999));
            Assert.AreEqual(0,b.GetVillage(ArenaTeam.Lux).Stone);
        }
        [Test] public void CanonicalWorkerSlotsAreReservedAndRecruitmentRequiresHousing(){
            var b=new OfflineBattle("phan");
            Assert.AreEqual(6,b.VillagePopulation(ArenaTeam.Lux));Assert.AreEqual(6,b.VillagePopulationCapacity(ArenaTeam.Lux));
            Assert.False(b.RecruitPlayerVillager());Assert.False(b.CancelPlayerRecruitment());Assert.False(b.RecruitmentPending(ArenaTeam.Lux));
            Assert.False(b.OrderPlayerConstruction(VillageBuildOrder.House,new Vector2(22,100)));
            var w=b.Units.Single(u=>u.Villager?.Job.Id=="lira");var foe=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            Assert.True(b.Hit(foe.State,w.State,300));Assert.AreEqual(6,b.VillagePopulation(ArenaTeam.Lux));
            Assert.False(b.RecruitPlayerVillager());
        }
        [Test] public void MarketRejectsUnfundedAndInvalidWithoutCooldown(){
            var b=new OfflineBattle("phan");Assert.False(b.TradePlayerResource(VillageResourceKind.Wood,true));Assert.False(b.TradePlayerResource(VillageResourceKind.Gold,false));Assert.AreEqual(0,b.MarketReadyAt);
        }
        [Test] public void ShopAndNearestRepairExposeValidState(){
            var b=new OfflineBattle("phan");Assert.True(b.CanUsePlayerShop);Assert.False(b.OrderPlayerRepairNearest());
            Assert.True(b.BuyPlayer("blade"));Assert.True(b.SellPlayer("blade"));Assert.AreEqual(72,b.Player.Gold);
        }
        [Test] public void IneffectiveSupportAndPrematureProductionDoNotSucceed(){
            var b=new OfflineBattle("phan");
            Assert.False(b.GiveItem(ArenaTeam.Lux,VillageItem.Heal,1));
            Assert.False(b.HealNearBase(ArenaTeam.Lux,25,700));
            Assert.False(b.CraftAtFront(ArenaTeam.Tenebra,VillageItem.Bomb));
            Assert.False(b.Deploy(ArenaTeam.Tenebra,ArenaLane.Mid,1,1));
            Assert.AreEqual(0,b.ReviveRecent(ArenaTeam.Tenebra,2,25,.6f));
        }
        [Test] public void DistinctResourceNodesAreMirroredAndOnlyFoodRegrows(){
            var b=new OfflineBattle("phan");
            Assert.AreEqual(13,b.ResourceNodes.Count);Assert.AreEqual(3,b.Territories.Count);
            Assert.True(b.ResourceNodes.Where(n=>n.Territory!=null).All(n=>!n.Team.HasValue));
            foreach(var kind in System.Enum.GetValues(typeof(VillageResourceKind)).Cast<VillageResourceKind>()){
                var pair=b.ResourceNodes.Where(n=>n.Kind==kind&&n.Territory==null).ToArray();Assert.AreEqual(2,pair.Length);
                Assert.AreEqual(pair[0].Capacity,pair[1].Capacity);
                Assert.AreEqual(OfflineBattle.Width,pair[0].Position.x+pair[1].Position.x,.001f);
                Assert.AreEqual(OfflineBattle.Height,pair[0].Position.y+pair[1].Position.y,.001f);
                Assert.AreEqual(kind==VillageResourceKind.Food,pair[0].Renewable);
            }
            Assert.False(b.OrderPlayerResource("velin",VillageResourceKind.Gold));
            Assert.False(b.OrderPlayerResource("lira",(VillageResourceKind)999));
            Assert.False(b.Deploy(ArenaTeam.Lux,ArenaLane.Mid,2,1));
        }
        [Test] public void FarmHarvestRequiresTravelAndDeliveryAndDoesNotMintOtherResources(){
            var b=new OfflineBattle("phan");var w=b.Units.Single(u=>u.Villager?.Job.Id=="lira");
            Assert.True(b.OrderPlayerResource("lira",VillageResourceKind.Food));
            for(int i=0;i<65;i++)b.Advance(.1f,Vector2.zero);
            Assert.Greater(w.CargoFood,0);Assert.AreEqual(0,w.CargoWood);Assert.AreEqual(0,b.GetVillage(w.Team).Food);
            Assert.False(((IVillageLogistics)b).TryGather(w.Team,"lira",999999,999999,999999));
            Assert.True(b.OrderPlayerWorker("lira",VillageWorkerOrder.Return));
            for(int i=0;i<65;i++)b.Advance(.1f,Vector2.zero);
            Assert.Greater(b.GetVillage(w.Team).Food,0);Assert.AreEqual(0,b.GetVillage(w.Team).Wood);
        }
        [Test] public void WorkerMustReachNodeAndDeliverBeforeTeamCredit(){
            var battle=new OfflineBattle("phan");
            var worker=battle.Units.Single(u=>u.Villager?.Job.Id=="lira");
            Assert.IsFalse(((IVillageLogistics)battle).TryGather(worker.Team,"lira",6,4,2));
            Assert.IsTrue(battle.OrderPlayerResource("lira",VillageResourceKind.Wood));
            Assert.IsFalse(battle.OrderPlayerWorker("velin",VillageWorkerOrder.Hold));
            Assert.IsTrue(battle.OrderPlayerWorker("lira",VillageWorkerOrder.Hold));
            for(int i=0;i<60;i++)battle.Advance(.1f,Vector2.zero);
            Assert.AreEqual(0,worker.Cargo);
            Assert.AreEqual(0,battle.GetVillage(worker.Team).Wood);
            Assert.IsTrue(battle.OrderPlayerWorker("lira",VillageWorkerOrder.Gather));
            for(int i=0;i<100;i++)battle.Advance(.1f,Vector2.zero);
            Assert.Greater(worker.Cargo,0);
            Assert.AreEqual(0,battle.GetVillage(worker.Team).Wood);
            Assert.IsTrue(battle.OrderPlayerWorker("lira",VillageWorkerOrder.Return));
            for(int i=0;i<100;i++)battle.Advance(.1f,Vector2.zero);
            Assert.Greater(battle.GetVillage(worker.Team).Wood,0);
        }
        [Test] public void QuinTrailRevealsAndHasCooldown(){
            var battle=new OfflineBattle("quin");
            var enemy=battle.Units.First(u=>u.Team!=battle.Player.Team&&u.Kind==BattleTargetKind.Hero);
            Assert.IsTrue(battle.Hit(battle.Player.State,enemy.State,10));
            Assert.Greater(enemy.State.Buff("revealed",5),0);
            Assert.AreEqual(0,enemy.State.Buff("revealed",6));
        }
        [Test] public void JawoSameTickHitsDoNotStackRhythm(){
            var battle=new OfflineBattle("jawo");
            var enemy=battle.Units.First(u=>u.Team!=battle.Player.Team&&u.Kind==BattleTargetKind.Hero);
            Assert.IsTrue(battle.Hit(battle.Player.State,enemy.State,10));
            float before=enemy.State.Health;
            Assert.IsTrue(battle.Hit(battle.Player.State,enemy.State,10));
            float second=before-enemy.State.Health;before=enemy.State.Health;
            Assert.IsTrue(battle.Hit(battle.Player.State,enemy.State,10));
            Assert.AreEqual(second,before-enemy.State.Health,.001f);
        }
        [Test] public void HeroDeathAndAssistSettleOnce(){
            var b=new OfflineBattle("phan");
            var ally=b.Units.First(u=>u.Team==ArenaTeam.Lux&&u.Kind==BattleTargetKind.Hero&&u!=b.Player);
            var enemy=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            int gold=ally.Gold;
            Assert.True(b.Hit(ally.State,enemy.State,10));
            Assert.True(b.Hit(b.Player.State,enemy.State,300));
            Assert.AreEqual(1,b.Player.Kills);Assert.AreEqual(1,enemy.Deaths);Assert.AreEqual(1,ally.Assists);
            Assert.AreEqual(gold+OfflineMatchRules.AssistGold,ally.Gold);
            Assert.False(b.Hit(b.Player.State,enemy.State,300));Assert.AreEqual(1,ally.Assists);
            Assert.AreEqual(0,new OfflineBattle("phan").Player.Kills);
        }
        [Test] public void TacticHasSeparateCooldownAndNoChargeForIneffectiveHeal(){
            var b=new OfflineBattle("phan");Assert.False(b.UsePlayerTactic(Vector2.zero));Assert.AreEqual(0,b.Player.TacticReadyAt);
            b.Player.State.Health=80;Assert.True(b.UsePlayerTactic(Vector2.zero));Assert.AreEqual(115,b.Player.State.Health);Assert.False(b.UsePlayerTactic(Vector2.zero));Assert.False(b.SelectPlayerTactic(ArenaTactic.Pursuit));
        }
        [Test] public void EveryHeroCanBePickedWithoutDuplicatingTeammates(){
            foreach(var kit in HeroKitCatalog.All){
                var b=new OfflineBattle(kit.Id);
                Assert.AreEqual(kit.Id,b.Player.State.Kit.Id);
                Assert.AreEqual(10,b.Units.Where(u=>u.Kind==BattleTargetKind.Hero).Select(u=>u.State.Kit.Id).Distinct().Count());
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
        [Test] public void StartsFiveVersusFiveAndRequiresFullElimination(){
            var b=new OfflineBattle("phan");
            Assert.AreEqual(5,b.Units.Count(u=>u.Kind==BattleTargetKind.Hero&&u.Team==ArenaTeam.Lux));
            Assert.AreEqual(5,b.Units.Count(u=>u.Kind==BattleTargetKind.Hero&&u.Team==ArenaTeam.Tenebra));
            var core=b.Units.Single(u=>u.Core&&u.Team==ArenaTeam.Tenebra);
            Assert.False(b.Hit(b.Player.State,core.State,100));
            var tower=b.Units.First(u=>u.Kind==BattleTargetKind.Structure&&u.Team==ArenaTeam.Tenebra&&!u.Core);
            Assert.True(b.Hit(b.Player.State,tower.State,300));Assert.True(b.Hit(b.Player.State,tower.State,100));
            Assert.True(b.Hit(b.Player.State,core.State,300));Assert.True(b.Hit(b.Player.State,core.State,300));
            Assert.False(b.Finished);Assert.IsNull(b.Winner);
            foreach(var unit in b.Units.Where(u=>u.Team==ArenaTeam.Tenebra&&u.State.Alive).ToArray()){
                for(int i=0;i<10&&unit.State.Alive;i++)Assert.True(b.Hit(b.Player.State,unit.State,300));
            }
            Assert.True(b.Finished);Assert.AreEqual(ArenaTeam.Lux,b.Winner);Assert.AreEqual(MatchEndReason.Elimination,b.EndReason);Assert.AreEqual(0,b.RemainingUnits(ArenaTeam.Tenebra));
            Assert.False(b.PlayerAttack(Vector2.right));
        }
        [Test] public void CoreLossStopsRespawnButNotRemainingEnemy(){
            var b=new OfflineBattle("phan");var enemy=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            Assert.True(b.Hit(b.Player.State,enemy.State,300));Assert.False(enemy.State.Alive);Assert.LessOrEqual(b.Drops.Count,1);
            if(b.Drops.Count>0)Assert.False(b.CollectPlayerPickup(b.Drops[0].Id));
            var tower=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Structure&&!u.Core);
            var core=b.Units.Single(u=>u.Team==ArenaTeam.Tenebra&&u.Core);
            foreach(var u in new[]{tower,core})while(u.State.Alive)Assert.True(b.Hit(b.Player.State,u.State,300));
            for(int i=0;i<90;i++)b.Advance(.1f,Vector2.zero);
            Assert.False(enemy.State.Alive);Assert.False(b.Finished);Assert.Greater(b.RemainingUnits(ArenaTeam.Tenebra),0);
            Assert.False(b.Units.Any(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Minion));
        }
        [Test] public void WavesAndMovementAreDrivenByMatchClock(){
            var b=new OfflineBattle("phan");var start=b.Player.Position;
            for(int i=0;i<60;i++)b.Advance(.1f,Vector2.right);
            Assert.Greater(b.Player.Position.x,start.x);
            Assert.Greater(b.Units.Count(u=>u.Kind==BattleTargetKind.Minion),0);
            Assert.AreEqual(6,b.Time,.001f);
        }
        [Test] public void SoldEquipmentDoesNotSurviveAndLostCoreDisablesShop(){
            var b=new OfflineBattle("phan");Assert.True(b.BuyPlayer("blade"));Assert.True(b.SellPlayer("blade"));Assert.AreEqual(72,b.Player.Gold);Assert.False(b.SellPlayer("blade"));
            var enemy=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            var tower=b.Units.First(u=>u.Team==ArenaTeam.Lux&&u.Kind==BattleTargetKind.Structure&&!u.Core);
            var core=b.Units.Single(u=>u.Team==ArenaTeam.Lux&&u.Core);
            foreach(var u in new[]{tower,core})while(u.State.Alive)Assert.True(b.Hit(enemy.State,u.State,300));
            b.Player.Gold=1000;Assert.False(b.BuyPlayer("blade"));
        }
        [Test] public void ShopAndRejectedSkillKeepMatchStateConsistent(){
            var b=new OfflineBattle("phan");
            Assert.True(b.BuyPlayer("blade"));Assert.AreEqual(0,b.Player.Gold);
            Assert.False(b.BuyPlayer("blade"));Assert.False(b.CastPlayer(SkillSlot.Primary,Vector2.right));
            Assert.AreEqual(100,b.Player.State.Mana);
        }
    }
}
