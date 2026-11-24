using System.Linq;
using NUnit.Framework;
namespace Buklod.Empire {
    public class ArenaCommercePreviewTests {
        [Test] public void CatalogueIsUniqueAndNeverSellsFromOffline(){
            var offers=ArenaCommercePreview.Build();
            Assert.AreEqual(offers.Count,offers.Select(o=>o.Id).Distinct().Count());
            Assert.AreEqual(13,offers.Count(o=>o.Kind==ArenaOfferKind.Stone));
            Assert.AreEqual(65,offers.Count(o=>o.Kind==ArenaOfferKind.HeroSkin));
            Assert.AreEqual(190,offers.Count);
            Assert.AreEqual(13,offers.Count(o=>o.Style=="mythical"&&o.IndicativePhp==999));
            Assert.AreEqual(13,offers.Count(o=>o.Style=="transformation"&&o.IndicativePhp==1499));
            Assert.IsTrue(offers.Single(o=>o.Style=="legendary_all").IndicativePhp==4999);
            Assert.AreEqual(2,offers.Count(o=>o.IsBusinessInquiry));
            Assert.IsTrue(offers.All(o=>!o.PurchaseEnabled));
            Assert.IsTrue(offers.Where(o=>o.Kind==ArenaOfferKind.Stone).All(o=>o.BpCost==100));
        }
        [Test] public void AdsFailClosedAndNeverRewardStones(){
            Assert.IsFalse(ArenaCommercePreview.EligibleRewardedTrial(ArenaOfferKind.Stone));
            Assert.IsFalse(ArenaCommercePreview.CanShowAd(true,true,true,true));
            Assert.IsFalse(ArenaCommercePreview.CanShowAd(false,true,false,true));
            Assert.IsFalse(ArenaCommercePreview.CanShowAd(false,true,true,false));
            Assert.IsFalse(ArenaCommercePreview.CanShowAd(false,false,true,true));
            Assert.IsTrue(ArenaCommercePreview.CanShowAd(false,true,true,true));
        }
    }
}
