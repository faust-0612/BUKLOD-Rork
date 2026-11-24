using System.Linq;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ArenaRelicTests {
        [Test] public void CanonicalRelicsAndConsumablesHaveNoDuplicateIds(){
            var all=ArenaRelicCatalog.All;Assert.AreEqual(364,all.Count);Assert.AreEqual(364,all.Select(x=>x.Id).Distinct().Count());
            Assert.AreEqual(260,all.Count(x=>!x.Consumable));Assert.AreEqual(104,all.Count(x=>x.Consumable));
            foreach(var h in HeroKitCatalog.All)Assert.AreEqual(28,all.Count(x=>x.Hero==h.Id));
            Assert.True(ArenaRelicCatalog.TryGet("phan-weapon-t1",out var item));Assert.AreEqual("Hand-Forged Farm Hoe",item.Name);Assert.AreEqual("phan:L01:I03",item.SourceKey);Assert.AreEqual(5,item.Stats.Attack);
            Assert.True(ArenaRelicCatalog.TryGet("quin-consumable-mana-t4",out item));Assert.AreEqual(75,item.Amount);Assert.AreEqual("quin:L03:I04",item.SourceKey);
        }
        [Test] public void RarityRequiresBothLevelAndQuality(){
            Assert.AreEqual(1,ArenaRelicCatalog.DropTier(1,1,true,true));Assert.AreEqual(2,ArenaRelicCatalog.DropTier(5,.5f,false,false));
            Assert.AreEqual(3,ArenaRelicCatalog.DropTier(12,.9f,false,false));Assert.AreEqual(4,ArenaRelicCatalog.DropTier(12,.9f,true,false));
        }
    }
}
