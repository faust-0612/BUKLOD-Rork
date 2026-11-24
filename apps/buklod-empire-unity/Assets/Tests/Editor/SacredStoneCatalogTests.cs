using System.Linq;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public class SacredStoneCatalogTests {
        [Test] public void EveryHeroHasOneDistinctStone(){
            var ids=new[]{"phan","quin","van","christian","lhen","ace","ellusur","jawo","mitch","niel","angel","vhen","trudice"};
            var names=new[]{"Jasper","Sapphire","Agate","Emerald","Onyx","Carnelian","Chrysolite","Beryl","Topaz","Chrysoprase","Jacinth","Amethyst","Diamond"};
            var catalog=SacredStoneCatalog.Load();
            Assert.AreEqual(13,catalog.Count);
            CollectionAssert.AreEquivalent(HeroKitCatalog.All.Select(x=>x.Id),catalog.Keys);
            for(int i=0;i<ids.Length;i++){
                Assert.IsTrue(SacredStoneCatalog.TryGet(ids[i],out var stone));
                Assert.AreEqual(names[i],stone.Name);
                Assert.AreEqual(i<12?i+1:0,stone.FoundationOrder);
                Assert.AreEqual(i<12?"Revelation 21:19-20 (NIV)":"BUKLOD original lore",stone.Source);
                Assert.AreEqual(1f,stone.Accent.a);
            }
        }
        [Test] public void InvalidHeroDoesNotResolve(){
            Assert.IsFalse(SacredStoneCatalog.TryGet(null,out _));
            Assert.IsFalse(SacredStoneCatalog.TryGet("unknown",out _));
        }
    }
}
