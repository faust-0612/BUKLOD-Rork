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
        [Test] public void PracticeNeverPromisesReward(){Assert.AreEqual("",ArenaProgression.TrainingResult(false));StringAssert.Contains("0 BP / 0 permanent XP",ArenaProgression.TrainingResult(true));}
        [Test] public void InvalidLevelsRejected(){Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.Evolution(0));Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.Evolution(21));}
    }
}
