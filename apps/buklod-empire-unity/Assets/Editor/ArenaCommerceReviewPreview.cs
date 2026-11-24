using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Editor-only preview provider: no review asset dependencies in Android builds.
    [InitializeOnLoad]
    public static class ArenaCommerceReviewPreview {
        const string Base=CandidateReviewComposer.Out;
        static ArenaCommerceReviewPreview(){ArenaCommercePanel.EditorReviewPreview=Resolve;BattleView.EditorPracticePrefab=ResolvePractice;}
        internal static string AssetPath(ArenaOffer o){
            if(o==null)return null;
            switch(o.Kind){
                case ArenaOfferKind.HeroSkin:return Base+"/Prefabs/"+o.Subject+"_"+o.Style+".prefab";
                case ArenaOfferKind.Weapon:return Base+"/PremiumCommerce/Models/"+o.Subject+"_relic.gltf";
                case ArenaOfferKind.Bundle:
                    if(o.Style=="transformation")return Base+"/PremiumCommerce/Prefabs/"+o.Subject+"_transformation.prefab";
                    return null;
                default:return null;
            }
        }
        static GameObject ResolvePractice(string hero,string style){
            if(!SacredStoneCatalog.TryGet(hero,out _)||!ArenaCosmeticPractice.IsSkinStyle(style)||style=="original")return null;
            var obj=AssetDatabase.LoadAssetAtPath<GameObject>(Base+"/Prefabs/"+hero+"_"+style+".prefab");
            if(!obj||!obj.GetComponentInChildren<SkinnedMeshRenderer>(true))return null;
            var animator=obj.GetComponentInChildren<Animator>(true);
            return animator&&animator.runtimeAnimatorController?obj:null;
        }
        static Texture Resolve(ArenaOffer offer){
            string path=AssetPath(offer);if(string.IsNullOrEmpty(path))return null;
            var model=AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if(!model)return null;
            // Use Unity's actual model preview, never the generic asset icon.
            return AssetPreview.GetAssetPreview(model);
        }
    }
}
