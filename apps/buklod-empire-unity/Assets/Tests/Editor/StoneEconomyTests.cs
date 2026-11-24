using System.Linq;
using System.Collections.Generic;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public class StoneEconomyTests {
        [Test] public void CatalogHas13DistinctMissionsAndKingdomLocations(){
            var m=StoneEconomy.LoadMissions();
            Assert.AreEqual(13,m.Count);
            Assert.AreEqual(13,m.Values.Select(x=>x.communityEvent).Distinct().Count());
            Assert.AreEqual(13,m.Values.Select(x=>x.locationId).Distinct().Count());
            CollectionAssert.AreEquivalent(HeroKitCatalog.All.Select(x=>x.Id),m.Keys);
        }
        [Test] public void EqualPriceAndOneStonePerAction(){
            Assert.AreEqual(100,StoneEconomy.ExchangeCost(1));
            Assert.AreEqual(1300,StoneEconomy.ExchangeCost(13));
            Assert.AreEqual(1,StoneEconomy.StonesPerPick);Assert.AreEqual(1,StoneEconomy.StonesPerBan);
            Assert.Throws<System.ArgumentOutOfRangeException>(()=>StoneEconomy.ExchangeCost(0));
        }
        [Test] public void MatchingHeroBalanceAndBanLimit(){
            var b=new Dictionary<string,long>{{"phan",1},{"quin",0}};
            Assert.IsTrue(StoneEconomy.CanSelect("phan",b,false,false));
            Assert.IsFalse(StoneEconomy.CanSelect("quin",b,false,false));
            Assert.IsFalse(StoneEconomy.CanSelect("phan",b,false,true));
            Assert.IsTrue(StoneEconomy.CanSelect("quin",null,true,false));
            Assert.IsTrue(StoneEconomy.CanBan("phan",b,0,true));
            Assert.IsFalse(StoneEconomy.CanBan("phan",b,1,true));
            Assert.IsFalse(StoneEconomy.CanBan("phan",b,0,false));
        }
    }
}
