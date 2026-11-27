using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ReviewSkillTrialTests {
        [Test] public void EveryCanonicalSkillHasAnIsolatedFiniteTrial(){
            foreach(var hero in HeroKitCatalog.All)for(int i=0;i<3;i++){
                var result=ReviewSkillTrial.Evaluate(hero.Id,(SkillSlot)i);
                Assert.True(ArenaDraftRules.Known(result.Enemy));Assert.AreNotEqual(hero.Id,result.Enemy);
                Assert.IsFalse(float.IsNaN(result.Damage));Assert.GreaterOrEqual(result.Damage,0);
                Assert.GreaterOrEqual(result.Healing,0);Assert.GreaterOrEqual(result.Shield,0);Assert.GreaterOrEqual(result.Displacement,0);
            }
        }
        [Test] public void PalettesNeverChangeSacredStoneOrSkin(){
            var baseColor=new Color(.23f,.44f,.56f,.9f);
            foreach(var p in new[]{ReviewPalette.Radiant,ReviewPalette.Nightwatch}){
                Assert.AreEqual(baseColor,ReviewHeroPalette.Tint("SacredStone_jasper",baseColor,p));
                Assert.AreEqual(baseColor,ReviewHeroPalette.Tint("skin",baseColor,p));
                Assert.AreNotEqual(baseColor,ReviewHeroPalette.Tint("armor",baseColor,p));
                Assert.AreEqual(baseColor.a,ReviewHeroPalette.Tint("armor",baseColor,p).a);
            }
        }
    }
}
