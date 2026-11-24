using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class BattleEffectsTests {
        [Test] public void AllHeroesHaveCanonicalStoneAccents(){
            foreach(var hero in HeroKitCatalog.All){
                Assert.That(SacredStoneCatalog.TryGet(hero.Id,out var stone),Is.True);
                Assert.That(BattleEffects.Accent(hero.Id),Is.EqualTo(Color.Lerp(stone.Accent,Color.white,.25f)));
            }
        }
        [Test] public void PulsePoolBudgetIsBounded(){
            Assert.That(BattleEffects.Capacity,Is.LessThanOrEqualTo(24));
            Assert.That(BattleEffects.Segments,Is.LessThanOrEqualTo(32));
        }
    }
}
