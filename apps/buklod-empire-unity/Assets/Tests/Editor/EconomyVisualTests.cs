using System;
using System.Linq;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class EconomyVisualTests {
        [Test] public void StockScaleTracksAuthoritativeStock(){
            Assert.AreEqual(.15f,BattleFieldVisuals.StockScale(0,96),.0001f);
            Assert.AreEqual(1f,BattleFieldVisuals.StockScale(96,96),.0001f);
            Assert.Less(BattleFieldVisuals.StockScale(12,96),BattleFieldVisuals.StockScale(48,96));
            Assert.AreEqual(1f,BattleFieldVisuals.StockScale(120,96),.0001f);
        }
        [Test] public void CargoAndLootPalettesAreDistinct(){
            Assert.AreEqual(5,Enum.GetValues(typeof(VillageResourceKind)).Cast<VillageResourceKind>().Select(BattleFieldVisuals.ResourceColor).Distinct().Count());
            Assert.AreEqual(4,Enumerable.Range(1,4).Select(BattleFieldVisuals.TierColor).Distinct().Count());
        }
    }
}
