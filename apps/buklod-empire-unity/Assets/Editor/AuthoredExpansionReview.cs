using System;
using System.IO;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Local opt-in authored props, decorative only. Never change navigation or hitboxes.
    internal static class AuthoredExpansionReview {
        const string Root="Assets/Generated/ReviewOnly/AuthoredExpansion/";
        internal static readonly string[] ModelPaths={
            Root+"village/glTF/Prop_Wagon.gltf",Root+"village/glTF/Prop_Crate.gltf",Root+"village/glTF/Prop_MetalFence_Ornament.gltf",Root+"village/glTF/Prop_Chimney.gltf",
            Root+"props/Exports/glTF/Anvil.gltf",Root+"props/Exports/glTF/Barrel.gltf",Root+"props/Exports/glTF/Banner_1.gltf",Root+"props/Exports/glTF/Chest_Wood.gltf",Root+"props/Exports/glTF/FarmCrate_Apple.gltf"
        };
        internal static bool Requested=>Environment.GetEnvironmentVariable("BUKLOD_AUTHORED_EXPANSION")=="1";
        internal static void Apply(){
            if(!Requested)return;
            if(!File.Exists(Root+"expansion-ready.json"))throw new InvalidOperationException("Prepare authored expansion before starting Unity.");
            var holder=new GameObject("Authored medieval environment expansion (review only)");
            for(int i=0;i<ModelPaths.Length;i++){
                var model=AssetDatabase.LoadAssetAtPath<GameObject>(ModelPaths[i]);
                if(!model)throw new InvalidOperationException("Missing imported authored model: "+ModelPaths[i]);
                for(int team=0;team<2;team++){
                    var obj=(GameObject)PrefabUtility.InstantiatePrefab(model,holder.transform);
                    if(!obj)throw new InvalidOperationException("Cannot instantiate authored model: "+ModelPaths[i]);
                    // Keep objects outside the canonical playable x bounds; do not obscure lanes.
                    obj.transform.localPosition=new Vector3(team==0?-3.2f:OfflineBattle.Width+3.2f,0,5+i*(OfflineBattle.Height-10)/8f);
                    obj.transform.localRotation=Quaternion.Euler(0,team==0?35:-145,0);
                    var renderers=obj.GetComponentsInChildren<Renderer>(true);
                    if(renderers.Length==0)throw new InvalidOperationException("Authored model has no renderer.");
                    var bounds=renderers[0].bounds;foreach(var r in renderers)bounds.Encapsulate(r.bounds);
                    float span=Mathf.Max(bounds.size.x,Mathf.Max(bounds.size.y,bounds.size.z));
                    if(span<=.001f||float.IsNaN(span)||float.IsInfinity(span))throw new InvalidOperationException("Invalid authored model bounds.");
                    obj.transform.localScale*=1.8f/span;
                    float minY=float.PositiveInfinity;foreach(var r in renderers)minY=Mathf.Min(minY,r.bounds.min.y);
                    obj.transform.position+=Vector3.up*(-minY);
                    foreach(var c in obj.GetComponentsInChildren<Collider>(true))c.enabled=false;
                }
            }
            Debug.Log("BUKLOD authored environment expansion: 9 models, 18 decorative instances.");
        }
        internal static void Validate(string[] dependencies){
            if(!Requested)return;
            var set=new System.Collections.Generic.HashSet<string>(dependencies,StringComparer.Ordinal);
            foreach(var p in ModelPaths)if(!set.Contains(p))throw new UnityEditor.Build.BuildFailedException("Missing authored expansion scene dependency: "+p);
            foreach(var name in new[]{"light_03.png","magic_03.png"}){
                string p=Root+"vfx/addons/kenney_particle_pack/"+name;
                if(!set.Contains(p))throw new UnityEditor.Build.BuildFailedException("Missing authored particle texture: "+p);
            }
        }
    }
}
