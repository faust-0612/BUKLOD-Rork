using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class VillageTechnologyTests {
        [Test] public void EveryBranchHasThreeOrderedTiersAndFiniteBenefits(){
            foreach(VillageTechnology tech in System.Enum.GetValues(typeof(VillageTechnology))){
                for(int current=0;current<3;current++){Assert.True(VillageTechnologyRules.TryQuote(tech,current,out var q));Assert.AreEqual(current+1,q.Tier);Assert.Greater(q.Wood+q.Stone+q.Food+q.Crystal+q.Gold,0);Assert.AreEqual(16+4*current,q.Seconds);}
                Assert.False(VillageTechnologyRules.TryQuote(tech,3,out _));
            }
            Assert.False(VillageTechnologyRules.TryQuote((VillageTechnology)99,0,out _));
            Assert.AreEqual(60,VillageTechnologyRules.CargoCapacity(3));
            Assert.AreEqual(24,VillageTechnologyRules.FarmRegrowth(3));
            Assert.AreEqual(1.36,VillageTechnologyRules.HarvestMultiplier(3),.0001);
            Assert.AreEqual(1.3,VillageTechnologyRules.BuildSpeed(3),.0001);
            Assert.AreEqual(1.12,VillageTechnologyRules.MilitaryPower(3),.0001);
        }
    }
}
