using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class OfflineBattleTests {
        static BattleUnit MidTower(OfflineBattle b,ArenaTeam team)=>b.Units.Single(u=>u.Team==team&&u.Kind==BattleTargetKind.Structure&&!u.Core&&u.Lane==ArenaLane.Mid);
        [Test] public void EveryHeroCanDamageAnEnemyAndAnEnemyTowerWithTouchIntent(){
            foreach(var kit in HeroKitCatalog.All){
                var b=new OfflineBattle(kit.Id);var p=b.Player;
                var enemy=b.Units.First(u=>u.Team!=p.Team&&u.Kind==BattleTargetKind.Hero);
                PlaceUnit(p,new Vector2(150,110));PlaceUnit(enemy,p.Position+Vector2.right*(kit.BasicRange*.5f));
                float hp=enemy.State.Health;
                Assert.True(b.RequestPlayerBasic(Vector2.zero),kit.Id);
                Assert.Less(enemy.State.Health,hp,kit.Id);
                Assert.False(b.HasPendingPlayerAttack,kit.Id);
                b=new OfflineBattle(kit.Id);p=b.Player;var tower=MidTower(b,ArenaTeam.Tenebra);
                PlaceUnit(p,tower.Position+Vector2.left*(kit.BasicRange*.5f));hp=tower.State.Health;
                Assert.True(b.RequestPlayerBasic(Vector2.zero,BattleTargetKind.Structure),kit.Id);
                Assert.Less(tower.State.Health,hp,kit.Id);
                Assert.AreEqual(tower.Position,p.LastAttackTargetPosition,kit.Id);
            }
        }
        [Test] public void TapApproachesOnceThenStopsAndManualMovementCancels(){
            var b=new OfflineBattle("phan");var p=b.Player;var tower=MidTower(b,ArenaTeam.Tenebra);
            PlaceUnit(p,tower.Position+Vector2.left*5);float hp=tower.State.Health;
            Assert.True(b.RequestPlayerBasic(Vector2.zero,BattleTargetKind.Structure));
            Assert.True(b.HasPendingPlayerAttack);Assert.AreEqual(hp,tower.State.Health);
            for(int i=0;i<30&&b.HasPendingPlayerAttack;i++)b.Advance(.1f,Vector2.zero);
            Assert.False(b.HasPendingPlayerAttack);Assert.Less(tower.State.Health,hp);
            float last=p.LastAttack;b.Advance(.1f,Vector2.zero);Assert.AreEqual(last,p.LastAttack);
            b=new OfflineBattle("phan");p=b.Player;tower=MidTower(b,ArenaTeam.Tenebra);
            PlaceUnit(p,tower.Position+Vector2.left*5);
            Assert.True(b.RequestPlayerBasic(Vector2.zero,BattleTargetKind.Structure));
            b.Advance(.1f,Vector2.left);Assert.False(b.HasPendingPlayerAttack);
            Assert.AreEqual(float.NegativeInfinity,p.LastAttack);
        }
        [Test] public void ProtectedCoreAndNoNearbyTargetDoNotSpendCooldown(){
            var b=new OfflineBattle("phan");var p=b.Player;
            Assert.False(b.RequestPlayerBasic(Vector2.zero,BattleTargetKind.Structure));Assert.AreEqual(0,b.BasicAttackRemaining(p));
            var core=b.Units.Single(u=>u.Team!=p.Team&&u.Core);PlaceUnit(p,core.Position+Vector2.up*2);
            float hp=core.State.Health;Assert.False(b.PlayerAttackUnit(core.Id));
            Assert.AreEqual(hp,core.State.Health);Assert.AreEqual(0,b.BasicAttackRemaining(p));
        }
        [Test] public void EnemyTowerActuallyDamagesNearbyHeroAndRecordsTarget(){
            var b=new OfflineBattle("phan");var p=b.Player;var tower=MidTower(b,ArenaTeam.Tenebra);
            PlaceUnit(p,tower.Position+Vector2.left*7);float hp=p.State.Health;
            b.Advance(.1f,Vector2.zero);
            Assert.Less(p.State.Health,hp);
            Assert.AreEqual(p.Position,tower.LastAttackTargetPosition);
            Assert.Greater(tower.LastAttack,float.NegativeInfinity);
        }
        [Test] public void OffCenterTouchWithoutDragHasNoDirectionalAim(){
            var contact=new Vector2(145,100);
            Assert.AreEqual(Vector2.zero,MobileBattleInput.ResolveAim(contact,contact,50));
            Assert.AreEqual(Vector2.left,MobileBattleInput.ResolveAim(contact+Vector2.left*60,contact,50));
        }
        [Test] public void EquipmentPresentationTracksActualPurchaseAndSale(){
            var b=new OfflineBattle("phan");var p=b.Player;
            Assert.AreEqual(0,ReviewEquipmentVisual.Tier(p,"weapon"));
            Assert.True(b.BuyPlayer("blade"));
            Assert.AreEqual(1,ReviewEquipmentVisual.Tier(p,"weapon"));
            Assert.AreEqual(0,ReviewEquipmentVisual.Tier(p,"armor"));
            Assert.True(b.SellPlayer("blade"));
            Assert.AreEqual(0,ReviewEquipmentVisual.Tier(p,"weapon"));
            Assert.AreEqual(0,ReviewEquipmentVisual.Tier(null,"weapon"));
        }
        [Test] public void PooledEquipmentVisualResetsAndDoesNotLeakPriorPurchase(){
            var root=new GameObject("wearable test");
            try{
                var component=root.AddComponent<ReviewEquipmentVisual>();
                var plate=new GameObject("plate");plate.transform.SetParent(root.transform,false);
                var trim=new GameObject("trim");trim.transform.SetParent(root.transform,false);
                component.mounts=new[]{new ReviewEquipmentVisual.Mount{slot="weapon",basePlate=plate,advancedTrim=trim}};
                var b=new OfflineBattle("phan");Assert.True(b.BuyPlayer("blade"));
                component.Apply(b.Player);Assert.True(plate.activeSelf);Assert.False(trim.activeSelf);
                component.ResetVisual();Assert.False(plate.activeSelf);Assert.False(trim.activeSelf);
                component.Apply(new OfflineBattle("phan").Player);Assert.False(plate.activeSelf);
                Assert.AreEqual(0,ReviewEquipmentVisual.Tier(b.Player,null));
            }finally{Object.DestroyImmediate(root);}
        }
        [Test] public void ReleaseAimUsesFinalPositionAndPreservesTapDeadzone(){
            var center=new Vector2(100,100);
            Assert.AreEqual(Vector2.zero,MobileBattleInput.ResolveAim(center+Vector2.right*5,center,40));
            Assert.AreEqual(Vector2.left,MobileBattleInput.ResolveAim(center+Vector2.left*80,center,40));
            Assert.AreEqual(new Vector2(0,.5f),MobileBattleInput.ResolveAim(center+Vector2.up*20,center,40));
        }
        [Test] public void PassiveIncomeDoesNotTriggerEarnedFeedbackButKillDoes(){
            var b=new OfflineBattle("phan");var p=b.Player;
            for(int i=0;i<11;i++)b.Advance(.1f,Vector2.zero);
            Assert.Greater(p.Gold,120);Assert.AreEqual(0,p.EarnedFeedbackSequence);
            var enemy=b.Units.First(u=>u.Team!=p.Team&&u.Kind==BattleTargetKind.Hero);
            for(int i=0;i<20&&enemy.State.Alive;i++)Assert.True(b.Hit(p.State,enemy.State,300));
            Assert.False(enemy.State.Alive);Assert.AreEqual(1,p.EarnedFeedbackSequence);
            Assert.False(b.Hit(p.State,enemy.State,300));Assert.AreEqual(1,p.EarnedFeedbackSequence);
        }
        [Test] public void BasicAttackHudUsesSameCooldownAsCombat(){
            var b=new OfflineBattle("phan");var p=b.Player;
            Assert.AreEqual(0,b.BasicAttackRemaining(p));float baseCooldown=b.BasicAttackCooldown(p);
            p.LastAttack=b.Time;Assert.AreEqual(baseCooldown,b.BasicAttackRemaining(p),.0001f);
            p.Gear.Add("fervor");Assert.Less(b.BasicAttackCooldown(p),baseCooldown);
            Assert.False(b.PlayerAttack(Vector2.zero));
            for(int i=0;i<100;i++)b.Advance(.1f,Vector2.zero);
            Assert.AreEqual(0,b.BasicAttackRemaining(p));
        }
        static Vector2 LaneObjective(OfflineBattle b,BattleUnit u)=>(Vector2)typeof(OfflineBattle).GetMethod("LaneGoal",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(b,new object[]{u});
        static BattleUnit DefenseObjective(OfflineBattle b,BattleUnit u)=>(BattleUnit)typeof(OfflineBattle).GetMethod("DefenseThreat",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).Invoke(b,new object[]{u});
        static void PlaceUnit(BattleUnit u,Vector2 position)=>typeof(BattleUnit).GetProperty(nameof(BattleUnit.Position)).SetValue(u,position);
        [Test] public void LaneClearedBotsRotateToFortress(){
            var b=new OfflineBattle("phan");var bot=b.Units.First(u=>u.Team==ArenaTeam.Lux&&u.Kind==BattleTargetKind.Hero&&u.Lane==ArenaLane.Top);
            var tower=b.Units.Single(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Structure&&!u.Core&&u.Lane==ArenaLane.Top);
            var core=b.Units.Single(u=>u.Team==ArenaTeam.Tenebra&&u.Core);
            PlaceUnit(bot,new Vector2(tower.Position.x-12,tower.Position.y));
            Assert.AreEqual(tower.Position,LaneObjective(b,bot));
            for(int i=0;i<10&&tower.State.Alive;i++)Assert.True(b.Hit(bot.State,tower.State,300));
            Assert.False(tower.State.Alive);Assert.AreEqual(core.Position,LaneObjective(b,bot));Assert.False(b.Finished);
        }
        [Test] public void VisibleBaseIncursionAssignsAtMostTwoBotsWithoutTakingPlayerControl(){
            var b=new OfflineBattle("phan",difficulty:ArenaDifficulty.Expert);
            var invader=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            var core=b.Units.Single(u=>u.Core&&u.Team==ArenaTeam.Lux);
            var allies=b.Units.Where(u=>u.Team==ArenaTeam.Lux&&u.Kind==BattleTargetKind.Hero&&u!=b.Player).ToArray();
            Assert.True(allies.All(u=>DefenseObjective(b,u)==null));
            PlaceUnit(invader,core.Position+new Vector2(4,0));
            Assert.AreEqual(2,allies.Count(u=>DefenseObjective(b,u)==invader));
            Assert.IsNull(DefenseObjective(b,b.Player));
            Assert.AreEqual(0,b.Player.Kills);
            var playerStart=b.Player.Position;b.Advance(.1f,Vector2.zero);Assert.AreEqual(playerStart,b.Player.Position);
        }
        [Test] public void InvalidSummonsDoNotChangeFactionCount(){
            var b=new OfflineBattle("phan");int before=b.RemainingUnits(ArenaTeam.Lux);
            Assert.False(b.Turret(b.Player.State,Vector2.right,5,float.NaN,10,20));
            Assert.False(b.Turret(b.Player.State,Vector2.right,5,100,float.PositiveInfinity,20));
            Assert.False(b.Turret(b.Player.State,Vector2.right,5,100,10,-1));
            Assert.AreEqual(before,b.RemainingUnits(ArenaTeam.Lux));Assert.AreEqual("",b.EndReason);
        }
        [Test] public void HybridAssetContractNeverMistakesBaseTowerForFarm(){
            var catalog=ScriptableObject.CreateInstance<BattleVisualCatalog>();var tower=new GameObject("Test tower");var farm=new GameObject("Test farm");
            try{
                catalog.factions=new[]{new BattleVisualCatalog.FactionVisual{team=ArenaTeam.Lux,tower=tower,farm=farm}};
                var b=new OfflineBattle("phan");var unit=b.Units.First(u=>u.Team==ArenaTeam.Lux&&u.Kind==BattleTargetKind.Structure&&!u.Core);
                Assert.AreSame(tower,catalog.Resolve(unit));
                // Internal test visibility is not needed: missing production evidence always fails closed.
                Assert.Throws<System.InvalidOperationException>(()=>catalog.Validate());Assert.IsNull(catalog.ResolveCamp(WildernessKind.AzureStag));
            }finally{Object.DestroyImmediate(tower);Object.DestroyImmediate(farm);Object.DestroyImmediate(catalog);}
        }
        [Test] public void NoMarketTradeOrConstructionWithoutInfrastructureAndResources(){
            var b=new OfflineBattle("phan");Assert.AreEqual(6,b.PaidTroopCapacity(ArenaTeam.Lux));Assert.AreEqual(0,b.PaidTroops(ArenaTeam.Lux));
            Assert.False(b.TradePlayerResource(VillageResourceKind.Food,true));Assert.False(b.TradePlayerResource(VillageResourceKind.Gold,false));
            Assert.False(b.OrderPlayerConstructionNearBase(VillageBuildOrder.House));Assert.False(b.OrderPlayerConstructionNearBase(VillageBuildOrder.Market));
            Assert.False(b.OrderPlayerRepairMostDamaged());Assert.True(b.CanShopPlayer);
        }
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
            Assert.AreEqual(10,b.ResourceNodes.Count);
            foreach(var kind in System.Enum.GetValues(typeof(VillageResourceKind)).Cast<VillageResourceKind>()){
                var pair=b.ResourceNodes.Where(n=>n.Kind==kind).ToArray();Assert.AreEqual(2,pair.Length);
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
            Assert.True(b.Finished);Assert.AreEqual(ArenaTeam.Lux,b.Winner);Assert.AreEqual(0,b.RemainingUnits(ArenaTeam.Tenebra));
            Assert.False(b.PlayerAttack(Vector2.right));
        }
        [Test] public void CoreLossStopsRespawnButNotRemainingEnemy(){
            var b=new OfflineBattle("phan");var enemy=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);
            Assert.True(b.Hit(b.Player.State,enemy.State,300));Assert.False(enemy.State.Alive);Assert.LessOrEqual(b.Drops.Count,1);
            if(b.Drops.Count>0)Assert.False(b.CollectPlayerPickup(b.Drops[0].Id));
            var tower=b.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Structure&&!u.Core);
            var core=b.Units.Single(u=>u.Team==ArenaTeam.Tenebra&&u.Core);
            foreach(var u in new[]{tower,core}){
                for(int hit=0;hit<64&&u.State.Alive;hit++)Assert.True(b.Hit(b.Player.State,u.State,300));
                Assert.False(u.State.Alive,"Structure must be destroyed within 64 successful hits.");
            }
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
            foreach(var u in new[]{tower,core}){
                for(int hit=0;hit<64&&u.State.Alive;hit++)Assert.True(b.Hit(enemy.State,u.State,300));
                Assert.False(u.State.Alive,"Structure must be destroyed within 64 successful hits.");
            }
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
