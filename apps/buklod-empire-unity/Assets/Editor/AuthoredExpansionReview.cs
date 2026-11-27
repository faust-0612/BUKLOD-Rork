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
                for(int team=0;team<2;team++)
                    Place(model,holder.transform,team,3.2f,5+i*(OfflineBattle.Height-10)/8f,1.8f);
            }
            // Six additional lane-aligned banners, framing the two bases from
            // outside the simulation rectangle. No colliders, navmesh or unit data.
            var banner=AssetDatabase.LoadAssetAtPath<GameObject>(ModelPaths[6]);
            if(!banner)throw new InvalidOperationException("Missing authored lane banner.");
            for(int team=0;team<2;team++)foreach(float fraction in new[]{.19f,.5f,.81f})
                Place(banner,holder.transform,team,1.45f,OfflineBattle.Height*fraction,2.2f);
            Debug.Log("BUKLOD authored environment expansion: 9 models, 24 exterior decorative instances.");
        }
        static Bounds BoundsFor(Renderer[] renderers){
            if(renderers.Length==0)throw new InvalidOperationException("Authored model has no renderer.");
            var bounds=renderers[0].bounds;
            foreach(var renderer in renderers)bounds.Encapsulate(renderer.bounds);
            return bounds;
        }
        static void Place(GameObject model,Transform parent,int team,float margin,float z,float spanLimit){
            var obj=(GameObject)PrefabUtility.InstantiatePrefab(model,parent);
            if(!obj)throw new InvalidOperationException("Cannot instantiate authored model.");
            obj.transform.localRotation=Quaternion.Euler(0,team==0?35:-145,0);
            var renderers=obj.GetComponentsInChildren<Renderer>(true);
            var bounds=BoundsFor(renderers);
            float span=Mathf.Max(bounds.size.x,Mathf.Max(bounds.size.y,bounds.size.z));
            if(span<=.001f||float.IsNaN(span)||float.IsInfinity(span))throw new InvalidOperationException("Invalid authored model bounds.");
            obj.transform.localScale*=spanLimit/span;
            bounds=BoundsFor(renderers);
            // Recenter imported pivot; guarantee the visible bounds never cover
            // canonical playable x coordinates even if original pivot is offset.
            float x=team==0?-margin:OfflineBattle.Width+margin;
            obj.transform.position+=new Vector3(x-bounds.center.x,-bounds.min.y,z-bounds.center.z);
            bounds=BoundsFor(renderers);
            if(team==0?bounds.max.x>=0:bounds.min.x<=OfflineBattle.Width)
                throw new InvalidOperationException("Exterior decoration intrudes on canonical battlefield.");
            foreach(var c in obj.GetComponentsInChildren<Collider>(true))c.enabled=false;
        }
        internal static void Validate(string[] dependencies){
            if(!Requested)return;
            PremiumSurfaceReview.Validate(dependencies);
            var set=new System.Collections.Generic.HashSet<string>(dependencies,StringComparer.Ordinal);
            foreach(var p in ModelPaths)if(!set.Contains(p))throw new UnityEditor.Build.BuildFailedException("Missing authored expansion scene dependency: "+p);
            foreach(var name in new[]{"light_03.png","magic_03.png"}){
                string p=Root+"vfx/addons/kenney_particle_pack/"+name;
                if(!set.Contains(p))throw new UnityEditor.Build.BuildFailedException("Missing authored particle texture: "+p);
            }
        }
    }
}
