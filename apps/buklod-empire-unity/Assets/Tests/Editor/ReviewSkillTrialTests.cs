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
        [Test] public void CostumePaletteUsesPropertyBlocksAndRestoresOriginal(){
            var root=GameObject.CreatePrimitive(PrimitiveType.Cube);
            var shader=Shader.Find("Universal Render Pipeline/Lit")??Shader.Find("Standard");
            Assert.IsNotNull(shader);var material=new Material(shader){name="armor"};
            try{
                var renderer=root.GetComponent<Renderer>();renderer.sharedMaterial=material;
                string prop=material.HasProperty("_BaseColor")?"_BaseColor":"_Color";
                var original=new Color(.2f,.3f,.4f,1);material.SetColor(prop,original);
                Assert.AreEqual(1,ReviewHeroPalette.Apply(root,ReviewPalette.Radiant));
                var block=new MaterialPropertyBlock();renderer.GetPropertyBlock(block,0);
                Assert.AreNotEqual(original,block.GetColor(prop));Assert.AreEqual(original,material.GetColor(prop));
                Assert.AreEqual(1,ReviewHeroPalette.Apply(root,ReviewPalette.Original));renderer.GetPropertyBlock(block,0);
                Assert.AreEqual(original,block.GetColor(prop));
            }finally{Object.DestroyImmediate(root);Object.DestroyImmediate(material);}
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
