using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ConsolidatedRenderBudgetTests {
        [Test] public void PlayerRetainsFullGeometryAndExplicitLowQualityUsesLod(){
            Assert.AreEqual(0,BattleRenderBudget.ReviewHeroLod(true,true,false,-1,100000));
            Assert.AreEqual(-1,BattleRenderBudget.ReviewHeroLod(false,true,true,0,0));
        }
        [Test] public void DetailHysteresisPreventsOscillationAndAllowsDistantLod(){
            Assert.AreEqual(0,BattleRenderBudget.ReviewHeroLod(true,false,true,-1,144));
            Assert.AreEqual(-1,BattleRenderBudget.ReviewHeroLod(true,false,true,-1,169));
            Assert.AreEqual(0,BattleRenderBudget.ReviewHeroLod(true,false,true,0,169));
            Assert.AreEqual(-1,BattleRenderBudget.ReviewHeroLod(true,false,true,0,226));
            Assert.AreEqual(-1,BattleRenderBudget.ReviewHeroLod(true,false,false,0,0));
        }
    }
}
