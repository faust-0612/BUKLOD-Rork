using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ReviewFarmGrowthTests {
        [Test] public void CropHeightReflectsStockWithoutScalingBuilding(){
            Assert.AreEqual(.10f,ReviewFarmGrowth.Height(0,96),.0001f);
            Assert.AreEqual(.55f,ReviewFarmGrowth.Height(48,96),.0001f);
            Assert.AreEqual(1f,ReviewFarmGrowth.Height(96,96),.0001f);
            Assert.AreEqual(1f,ReviewFarmGrowth.Height(120,96),.0001f);
            Assert.AreEqual(.10f,ReviewFarmGrowth.Height(-1,96),.0001f);
            Assert.AreEqual(.10f,ReviewFarmGrowth.Height(double.NaN,96),.0001f);
        }
    }
}
