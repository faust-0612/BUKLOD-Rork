using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ReviewContactShadowTests {
        [Test] public void ContactFootprintsRespectActorScale(){
            Assert.Greater(ReviewContactShadows.Radius(BattleTargetKind.Structure,true),ReviewContactShadows.Radius(BattleTargetKind.Structure,false));
            Assert.Greater(ReviewContactShadows.Radius(BattleTargetKind.Hero,false),ReviewContactShadows.Radius(BattleTargetKind.Minion,false));
            Assert.AreEqual(160,ReviewContactShadows.Capacity);
        }
    }
}
