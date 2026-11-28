using System;
using UnityEngine;
namespace Buklod.Empire {
    public enum ReviewPalette { Original, Radiant, Nightwatch }
    // Reuse the original approved-candidate meshes/textures; only four costume
    // base-color properties change, matching the authored variant recipe.
    // No material asset mutation, item entitlement, Sacred Stone or stat change.
    public static class ReviewHeroPalette {
        public static Color Tint(string material,Color original,ReviewPalette style){
            if(style==ReviewPalette.Original)return original;
            Color target;float amount;
            bool radiant=style==ReviewPalette.Radiant;
            if(!radiant&&style!=ReviewPalette.Nightwatch)return original;
            switch(material){
                case "armor":target=radiant?new Color(.83f,.87f,.88f):new Color(.055f,.075f,.12f);amount=radiant?.55f:.68f;break;
                case "trim":target=radiant?new Color(.96f,.78f,.38f):new Color(.40f,.53f,.65f);amount=radiant?.45f:.55f;break;
                case "fabric":target=radiant?new Color(.42f,.48f,.49f):new Color(.045f,.055f,.08f);amount=radiant?.45f:.55f;break;
                case "leather":target=radiant?new Color(.37f,.26f,.18f):new Color(.055f,.045f,.065f);amount=radiant?.45f:.55f;break;
                default:return original;
            }
            var color=Color.Lerp(original,target,amount);color.a=original.a;return color;
        }
        internal static int Apply(GameObject root,ReviewPalette style){
            if(!root)return 0;int count=0;var block=new MaterialPropertyBlock();
            foreach(var r in root.GetComponentsInChildren<Renderer>(true)){
                var materials=r.sharedMaterials;
                for(int i=0;i<materials.Length;i++){
                    var material=materials[i];if(!material)continue;string name=material.name;
                    if(name!="armor"&&name!="trim"&&name!="fabric"&&name!="leather")continue;
                    string prop=material.HasProperty("_BaseColor")?"_BaseColor":material.HasProperty("_Color")?"_Color":null;
                    if(prop==null)continue;
                    block.Clear();r.GetPropertyBlock(block,i);block.SetColor(prop,Tint(name,material.GetColor(prop),style));r.SetPropertyBlock(block,i);count++;
                }
            }
            return count;
        }
    }
}
