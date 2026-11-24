using System.Linq;
using NUnit.Framework;
namespace Buklod.Empire {
    public class ArenaCosmeticPracticeTests {
        [Test] public void OnlyCanonicalHeroSkinsCanBeTried(){
            var offers=ArenaCommercePreview.Build();
            Assert.AreEqual(65,offers.Count(ArenaCosmeticPractice.IsSupported));
            Assert.IsFalse(ArenaCosmeticPractice.IsSkinStyle("transformation"));
            Assert.IsFalse(ArenaCosmeticPractice.IsSkinStyle(null));
            Assert.IsTrue(offers.Where(ArenaCosmeticPractice.IsSupported).All(o=>!o.PurchaseEnabled));
        }
    }
}
