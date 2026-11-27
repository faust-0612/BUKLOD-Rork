using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class BattleRenderBudgetTests {
        [Test] public void PlayerAndVisibleUnitsAreNeverDistanceCulled(){
            Assert.True(BattleRenderBudget.RetainVisual(true,false,false,1000000));
            Assert.True(BattleRenderBudget.RetainVisual(false,true,false,1000000));
        }
        [Test] public void WarmAndRetainRadiiProvideHysteresis(){
            Assert.True(BattleRenderBudget.RetainVisual(false,false,false,32*32));
            Assert.False(BattleRenderBudget.RetainVisual(false,false,false,35*35));
            Assert.True(BattleRenderBudget.RetainVisual(false,false,true,35*35));
            Assert.False(BattleRenderBudget.RetainVisual(false,false,true,39*39));
        }
        [Test] public void NearbyAudioRangeIsWithinWarmRadius(){
            Assert.True(BattleRenderBudget.RetainVisual(false,false,false,26*26));
        }
        [Test] public void ShadowHysteresisAndPlayerProtection(){
            Assert.True(BattleRenderBudget.KeepShadow(true,false,1000000));
            Assert.True(BattleRenderBudget.KeepShadow(false,true,20*20));
            Assert.False(BattleRenderBudget.KeepShadow(false,false,20*20));
            Assert.False(BattleRenderBudget.KeepShadow(false,true,23*23));
        }
        [Test] public void DeathVisualsHaveSeparateBoundedBudget(){
            Assert.True(BattleRenderBudget.CanRetire(0));Assert.True(BattleRenderBudget.CanRetire(15));
            Assert.False(BattleRenderBudget.CanRetire(16));Assert.False(BattleRenderBudget.CanRetire(-1));
        }
        [Test] public void PoolLimitsAreBothEnforced(){
            Assert.True(BattleRenderBudget.CanPool(63,7));
            Assert.False(BattleRenderBudget.CanPool(64,0));
            Assert.False(BattleRenderBudget.CanPool(0,8));
        }
    }
}
