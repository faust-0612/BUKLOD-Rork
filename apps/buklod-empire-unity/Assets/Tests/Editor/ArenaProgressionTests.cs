using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public class ArenaProgressionTests {
        [TestCase(1,"Awakening")][TestCase(4,"Awakening")][TestCase(5,"Emergence")][TestCase(10,"Ascension")][TestCase(15,"Transcendence")][TestCase(20,"Awakened Legend")]
        public void EvolutionUsesExistingLevel(int level,string name)=>Assert.AreEqual(name,ArenaProgression.Evolution(level));
        [Test] public void PracticeNeverPromisesReward(){Assert.AreEqual("",ArenaProgression.TrainingResult(false));StringAssert.Contains("0 BP / 0 permanent XP",ArenaProgression.TrainingResult(true));}
        [Test] public void InvalidLevelsRejected(){Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.Evolution(0));Assert.Throws<System.ArgumentOutOfRangeException>(()=>ArenaProgression.Evolution(21));}
    }
}
