using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public class ArenaProgressionTests {
        [TestCase(1,"Awakening")][TestCase(4,"Awakening")][TestCase(5,"Emergence")][TestCase(10,"Ascension")][TestCase(15,"Transcendence")][TestCase(20,"Awakened Legend")]
        public void EvolutionUsesExistingLevel(int level,string name)=>Assert.AreEqual(name,ArenaProgression.Evolution(level));
        [Test] public void LivePreviewFramingPreservesFullBody(){
            var size=new UnityEngine.Vector3(1,2,1);
            Assert.Greater(ReviewHeroShowcase.FrameSize(size,.8f,true),ReviewHeroShowcase.FrameSize(size,.8f,false));
            Assert.GreaterOrEqual(ReviewHeroShowcase.FrameSize(size,.8f,true),size.y*.5f);
            Assert.Throws<System.ArgumentException>(()=>ReviewHeroShowcase.FrameSize(size,0,true));
        }
        [Test] public void TutorialRequiresActualMovementThenAttackThenCast(){
            var g=new ReviewPracticeGuide(UnityEngine.Vector2.zero,float.NegativeInfinity,0);
            g.Observe(new UnityEngine.Vector2(20,0),true,1,1);
            Assert.AreEqual(0,g.Step,"Teleport does not count.");
            g.Observe(new UnityEngine.Vector2(21.5f,0),true,1,1);
            g.Observe(new UnityEngine.Vector2(23,0),true,1,1);
            Assert.AreEqual(1,g.Step);
            g.Observe(new UnityEngine.Vector2(23,0),false,1,2);
            Assert.AreEqual(1,g.Step,"Old attack and unrelated skill do not advance.");
            g.Observe(new UnityEngine.Vector2(23,0),false,2,2);
            Assert.AreEqual(2,g.Step);
            g.Observe(new UnityEngine.Vector2(23,0),false,2,2);
            Assert.AreEqual(2,g.Step);
            g.Observe(new UnityEngine.Vector2(23,0),false,2,3);
            Assert.AreEqual(3,g.Step);
        }
        [Test] public void ShowcaseCueKeepsCanonicalIdentityAndTiming(){
            foreach(var cue in SkillCueCatalog.All){
                var scaled=ReviewHeroShowcase.ScaleCue(cue,2);
                Assert.AreEqual(cue.Id,scaled.Id);Assert.AreEqual(cue.Index,scaled.Index);
                Assert.AreEqual(cue.Shape,scaled.Shape);Assert.AreEqual(cue.Duration,scaled.Duration);
                Assert.Greater(scaled.Size,0);Assert.LessOrEqual(scaled.Size,.76f);
            }
        }
        [Test] public void EvolutionWingMeshHasTwoLayeredSurfaces(){
            foreach(int side in new[]{-1,1}){
                var mesh=ReviewEvolutionWings.CreateMesh(side);
                try{
                    Assert.AreEqual(2,mesh.subMeshCount);Assert.AreEqual(17*9*9,mesh.vertexCount);
                    Assert.Greater(mesh.bounds.size.x,.5f);Assert.Greater(mesh.bounds.size.y,.5f);
                    Assert.Greater(mesh.GetIndexCount(0),0u);Assert.Greater(mesh.GetIndexCount(1),0u);
                }finally{UnityEngine.Object.DestroyImmediate(mesh);}
            }
        }
        [Test] public void AllHeroWeaponCuesHaveDistinctBoundedPlayback(){
            var seen=new System.Collections.Generic.HashSet<(bool,float)>();
            foreach(var hero in HeroKitCatalog.All){
                var cue=ReviewWeaponProfiles.Audio(hero.Id);
                Assert.That(cue.Pitch,Is.InRange(.7f,1.5f));
                Assert.True(seen.Add(cue),hero.Id);
            }
            Assert.AreEqual(13,seen.Count);
        }
        [Test] public void ResultPresentationReflectsActualWinnerAndBoundedReveal(){
            Assert.AreEqual("VICTORY",ReviewResultPresentation.Outcome(ArenaTeam.Tenebra,ArenaTeam.Tenebra));
            Assert.AreEqual("DEFEAT",ReviewResultPresentation.Outcome(ArenaTeam.Lux,ArenaTeam.Tenebra));
            Assert.AreEqual("DRAW",ReviewResultPresentation.Outcome(ArenaTeam.Lux,null));
            Assert.AreEqual("TENEBRA PREVAILS",ReviewResultPresentation.Faction(ArenaTeam.Tenebra));
            Assert.AreEqual(0,ReviewResultPresentation.Reveal(.1f,.2f));
            Assert.That(ReviewResultPresentation.Reveal(.3f,.2f),Is.InRange(.01f,.99f));
            Assert.AreEqual(1,ReviewResultPresentation.Reveal(1,.2f));
        }
        [Test] public void PreviewStagesCycleCanonicalThresholdsWithoutGrantingProgress(){
            int level=1,stage=0;
            foreach(int expected in new[]{1,5,10,15,20}){
                Assert.AreEqual(expected,level);Assert.AreEqual(stage++,ArenaProgression.PreviewStage(level));
                level=ArenaProgression.NextPreviewLevel(level);
            }
            Assert.AreEqual(1,level);
            Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.PreviewStage(4));
            Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.NextPreviewLevel(21));
            StringAssert.Contains("0 BP / 0 permanent XP",ArenaProgression.TrainingResult(true));
        }
        [Test] public void PracticeNeverPromisesReward(){Assert.AreEqual("",ArenaProgression.TrainingResult(false));StringAssert.Contains("0 BP / 0 permanent XP",ArenaProgression.TrainingResult(true));}
        [Test] public void InvalidLevelsRejected(){Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.Evolution(0));Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.Evolution(21));}
    }
}
