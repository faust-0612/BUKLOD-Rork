using System.Linq;
using System.Collections.Generic;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public class ArenaStoneRulesTests {
        [Test] public void AllThirteenRecipesAreBalancedAndReversibleInInputOrder(){
            var heroes=HeroKitCatalog.All.Select(x=>x.Id).ToArray();
            var all=heroes.SelectMany(ArenaStoneRules.Ingredients).ToArray();
            foreach(var h in heroes){var r=ArenaStoneRules.Ingredients(h);Assert.AreEqual(2,r.Length);
                Assert.AreEqual(h,ArenaStoneRules.RecipeOutput(r[0],r[1]));Assert.AreEqual(h,ArenaStoneRules.RecipeOutput(r[1],r[0]));
                Assert.AreEqual(2,all.Count(x=>x==h));Assert.IsNotNull(ArenaStoneRules.CounterEffect(h));}
        }
        [Test] public void ConversionCannotReuseUnavailableInputs(){
            var b=new Dictionary<string,long>{{"quin",8},{"trudice",5}};
            Assert.AreEqual(5,ArenaStoneRules.RecipeCapacity("phan",b));
            Assert.IsTrue(ArenaStoneRules.CanConvert("phan",new[]{"quin","trudice"},b,false));
            Assert.IsFalse(ArenaStoneRules.CanConvert("quin",new[]{"quin","trudice"},b,false));
            Assert.IsTrue(ArenaStoneRules.CanConvert("phan",new[]{"quin","quin","quin"},b,true));
            Assert.IsFalse(ArenaStoneRules.CanConvert("phan",new[]{"quin","van","quin"},b,true));
        }
        [Test] public void CounterRequiresMatchingEnemyAndCasualMode(){
            Assert.IsTrue(ArenaStoneRules.CanCounter("quin","quin",true,true,true,false,0,8,false));
            Assert.IsFalse(ArenaStoneRules.CanCounter("quin","phan",true,true,true,false,0,8,false));
            Assert.IsFalse(ArenaStoneRules.CanCounter("quin","quin",true,true,true,true,0,8,false));
            Assert.IsFalse(ArenaStoneRules.CanCounter("quin","quin",true,true,true,false,1,8,false));
            Assert.IsFalse(ArenaStoneRules.CanCounter("quin","quin",true,true,true,false,0,13,false));
            Assert.IsFalse(ArenaStoneRules.CanCounter("quin","quin",true,true,true,false,0,8,true));
            Assert.IsFalse(ArenaStoneRules.CanCounter("quin","quin",false,true,true,false,0,8,false));
        }
        [Test] public void DraftSwapRequiresBothConsentsAndMatchingBalances(){
            var a=new Dictionary<string,long>{{"quin",1}};var b=new Dictionary<string,long>{{"phan",1}};
            Assert.IsTrue(ArenaStoneRules.CanDraftSwap("phan","quin",true,true,true,true,a,b,false,false));
            Assert.IsFalse(ArenaStoneRules.CanDraftSwap("phan","quin",true,true,false,true,a,b,false,false));
            Assert.IsFalse(ArenaStoneRules.CanDraftSwap("phan","quin",true,true,true,false,a,b,false,false));
            Assert.IsFalse(ArenaStoneRules.CanDraftSwap("phan","quin",true,true,true,true,a,b,true,false));
            Assert.IsFalse(ArenaStoneRules.CanDraftSwap("phan","quin",true,true,true,true,b,a,false,false));
        }
        [Test] public void SynergyIsAdviceForCompleteLineup(){
            CollectionAssert.Contains(ArenaStoneRules.TeamSynergies(new[]{"phan","van","christian"}),"Frontline control");
            Assert.AreEqual(0,ArenaStoneRules.TeamSynergies(new[]{"phan","van"}).Count);
        }
        [Test] public void CounterExpiresAndOnlyAffectsItsCategory(){
            var q=new SkillActor("quin");Assert.AreEqual(1f,ArenaStoneRules.Scale(q,"mobility",0));
            q.Set(ArenaStoneRules.CounterBuff,1,4,0);
            Assert.AreEqual(.8f,ArenaStoneRules.Scale(q,"mobility",1));
            Assert.AreEqual(1f,ArenaStoneRules.Scale(q,"heal",1));
            Assert.AreEqual(1f,ArenaStoneRules.Scale(q,"mobility",4));
        }
    }
}
