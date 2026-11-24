using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public class ArenaDraftTests {
        [Test] public void TenDistinctHeroesAndTwoBansFitRoster(){
            var heroes=HeroKitCatalog.All.Select(h=>h.Id).ToArray();
            var picks=heroes.Take(10).Select((h,i)=>new ArenaDraftPick("p"+i,h,i<5?ArenaTeam.Lux:ArenaTeam.Tenebra)).ToArray();
            Assert.True(ArenaDraftRules.Valid(picks,heroes[10],heroes[11]));Assert.False(ArenaDraftRules.Valid(picks,heroes[0],heroes[11]));
            Assert.False(ArenaDraftRules.Valid(picks,heroes[10],heroes[10]));
            Assert.True(ArenaDraftRules.IsEnemyCounter("p0",heroes[5],picks));Assert.False(ArenaDraftRules.IsEnemyCounter("p0",heroes[1],picks));
        }
        [Test] public void CombinationOnlyQuotesCanonicalIngredientsWithoutMutation(){
            var b=new Dictionary<string,long>{{"phan",2},{"quin",1},{"van",1}};
            Assert.True(StoneEconomy.TryQuoteCombination(new[]{"phan","phan"},"quin",b,out var cost));Assert.AreEqual(2,cost["phan"]);Assert.AreEqual(2,b["phan"]);
            Assert.True(StoneEconomy.TryQuoteCombination(new[]{"phan","quin","van"},"ace",b,out _));
            Assert.False(StoneEconomy.TryQuoteCombination(new[]{"phan","phan"},"phan",b,out _));Assert.False(StoneEconomy.TryQuoteCombination(new[]{"quin","quin"},"ace",b,out _));
        }
    }
}
