using System.Collections;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
namespace Buklod.Empire.Tests {
    public sealed class RuntimeBattleSmokeTests {
#if UNITY_EDITOR
        private UnityEngine.SceneManagement.Scene reviewScene,priorScene;
        private static void Place(BattleUnit unit,Vector2 position)=>typeof(BattleUnit).GetProperty(nameof(BattleUnit.Position)).SetValue(unit,position);
        [UnityTearDown] public IEnumerator CloseReviewScene(){
            if(reviewScene.IsValid()&&reviewScene.isLoaded){
                if(priorScene.IsValid()&&priorScene.isLoaded)UnityEngine.SceneManagement.SceneManager.SetActiveScene(priorScene);
                yield return UnityEngine.SceneManagement.SceneManager.UnloadSceneAsync(reviewScene);
            }
        }
        [UnityTest] public IEnumerator ActualReviewSceneStartsAndAttacksWithEveryHero(){
            const string path="Assets/Generated/ReviewOnly/StylizedPhanBenchmark.unity";
            Assert.NotNull(UnityEditor.AssetDatabase.LoadAssetAtPath<UnityEditor.SceneAsset>(path),"Existing local diagnostic scene required; run normal scene preparation if absent, not an APK build.");
            Assert.AreNotEqual(UnityEngine.Rendering.GraphicsDeviceType.Null,SystemInfo.graphicsDeviceType,"Graphics-capable Unity required");
            priorScene=UnityEngine.SceneManagement.SceneManager.GetActiveScene();
            reviewScene=UnityEditor.SceneManagement.EditorSceneManager.LoadSceneInPlayMode(path,new UnityEngine.SceneManagement.LoadSceneParameters(UnityEngine.SceneManagement.LoadSceneMode.Additive));
            Assert.True(reviewScene.IsValid()&&reviewScene.isLoaded);
            UnityEngine.SceneManagement.SceneManager.SetActiveScene(reviewScene);
            yield return null;
            var view=reviewScene.GetRootGameObjects().SelectMany(g=>g.GetComponentsInChildren<BattleView>(true)).Single();
            Assert.True(view.IsConfiguredReview);
            foreach(var kit in HeroKitCatalog.All){
                view.StartMatch(kit.Id);view.SetPaused(false);
                Assert.AreEqual(kit.Id,view.Battle.Player.State.Kit.Id);
                Assert.Greater(view.ActiveVisualCount,0,kit.Id);
                var b=view.Battle;var p=b.Player;var enemy=b.Units.First(u=>u.Team!=p.Team&&u.Kind==BattleTargetKind.Hero);
                Place(p,new Vector2(150,110));Place(enemy,p.Position+Vector2.right*(kit.BasicRange*.5f));
                yield return null;
                float hp=enemy.State.Health;
                Assert.True(view.Cast(1,Vector2.zero),kit.Id+" basic attack");
                Assert.Less(enemy.State.Health,hp,kit.Id+" damage");
                yield return null;
                var active=(System.Collections.IDictionary)typeof(BattleView).GetField("active",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).GetValue(view);
                var visual=active[p.Id];Assert.NotNull(visual,kit.Id+" live visual");
                var type=visual.GetType();
                Assert.AreEqual(p.LastAttack,(float)type.GetField("attack").GetValue(visual),kit.Id+" attack reached animation sync");
                var fallback=type.GetField("fallback").GetValue(visual);
                if(fallback!=null){
                    var clips=(System.Collections.IDictionary)fallback.GetType().GetField("indices",System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic).GetValue(fallback);
                    Assert.True(clips.Contains("Attack"),kit.Id+" fallback attack clip");
                }else{
                    var parameters=(System.Collections.Generic.HashSet<string>)type.GetField("parameters").GetValue(visual);
                    Assert.True(parameters.Contains("Attack"),kit.Id+" live Attack trigger");
                }
                LogAssert.NoUnexpectedReceived();
            }
            view.StartMatch("phan");view.SetPaused(false);
            var battle=view.Battle;var player=battle.Player;
            var tower=battle.Units.Single(u=>u.Team!=player.Team&&u.Kind==BattleTargetKind.Structure&&!u.Core&&u.Lane==ArenaLane.Mid);
            Place(player,tower.Position+Vector2.left*2);
            yield return null;
            float towerHp=tower.State.Health;Assert.True(view.Cast(8,Vector2.zero));Assert.Less(tower.State.Health,towerHp);
            float playerHp=player.State.Health;
            for(int i=0;i<12;i++)battle.Advance(.1f,Vector2.zero);
            Assert.Less(player.State.Health,playerHp,"Enemy tower must deal real damage");
            yield return null;LogAssert.NoUnexpectedReceived();view.SetPaused(true);
        }
#endif
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
