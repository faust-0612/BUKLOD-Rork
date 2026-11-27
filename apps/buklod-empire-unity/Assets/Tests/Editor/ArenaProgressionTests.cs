using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public class ArenaProgressionTests {
        [TestCase(1,"Awakening")][TestCase(4,"Awakening")][TestCase(5,"Emergence")][TestCase(10,"Ascension")][TestCase(15,"Transcendence")][TestCase(20,"Awakened Legend")]
        public void EvolutionUsesExistingLevel(int level,string name)=>Assert.AreEqual(name,ArenaProgression.Evolution(level));
        [Test] public void LivePreviewFramingPreservesFullBody(){
            var size=new UnityEngine.Vector3(1,2,1);
            Assert.Greater(ReviewLiveHeroPreview.FrameSize(size,.8f,true),ReviewLiveHeroPreview.FrameSize(size,.8f,false));
            Assert.GreaterOrEqual(ReviewLiveHeroPreview.FrameSize(size,.8f,true),size.y*.5f);
            Assert.Throws<System.ArgumentException>(()=>ReviewLiveHeroPreview.FrameSize(size,0,true));
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
                var scaled=ReviewLiveHeroPreview.ScaleCue(cue,2);
                Assert.AreEqual(cue.Id,scaled.Id);Assert.AreEqual(cue.Index,scaled.Index);
                Assert.AreEqual(cue.Shape,scaled.Shape);Assert.AreEqual(cue.Duration,scaled.Duration);
                Assert.Greater(scaled.Size,0);Assert.LessOrEqual(scaled.Size,.76f);
            }
        }
        [Test] public void PracticeNeverPromisesReward(){Assert.AreEqual("",ArenaProgression.TrainingResult(false));StringAssert.Contains("0 BP / 0 permanent XP",ArenaProgression.TrainingResult(true));}
        [Test] public void InvalidLevelsRejected(){Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.Evolution(0));Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.Evolution(21));}
    }
}
