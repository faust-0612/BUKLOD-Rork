using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ReviewCombatOverlayTests {
        [Test] public void BoundedValuesNeverProduceInvalidHudGeometry(){
            Assert.AreEqual(0,ReviewCombatOverlay.Fraction(float.NaN,100));
            Assert.AreEqual(0,ReviewCombatOverlay.Fraction(10,0));
            Assert.AreEqual(0,ReviewCombatOverlay.Fraction(-2,100));
            Assert.AreEqual(.5f,ReviewCombatOverlay.Fraction(50,100));
            Assert.AreEqual(1,ReviewCombatOverlay.Fraction(150,100));
            Assert.AreEqual(0,ReviewCombatOverlay.DamageNumber(float.PositiveInfinity));
            Assert.AreEqual(0,ReviewCombatOverlay.DamageNumber(-1));
            Assert.AreEqual(25,ReviewCombatOverlay.DamageNumber(25));
            Assert.AreEqual(99999,ReviewCombatOverlay.DamageNumber(1000000));
        }
    }
}
