using System;
using System.IO;
using System.Collections.Generic;
using System.Linq;
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
        static bool Candidate=>Environment.GetEnvironmentVariable("BUKLOD_OFFLINE_CANDIDATE")=="1";
        [Serializable] sealed class Placement {public string requested,actual;}
        [Serializable] sealed class DecorationReport {public string status;public Placement[] placements;public int instances;public bool productionApproved;}
        static Placement[] resolved;
        static GameObject Load(string path){
            var model=AssetDatabase.LoadAssetAtPath<GameObject>(path);
            if(!model&&File.Exists(path)){
                Debug.LogWarning("Retrying authored decorative import: "+path);
                AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceUpdate|ImportAssetOptions.ForceSynchronousImport);
                model=AssetDatabase.LoadAssetAtPath<GameObject>(path);
            }
            return model&&model.GetComponentsInChildren<Renderer>(true).Length>0?model:null;
        }
        internal static void Apply(){
            resolved=null;
            if(!Requested)return;
            if(!File.Exists(Root+"expansion-ready.json"))throw new InvalidOperationException("Prepare authored expansion before starting Unity.");
            // Resolve the entire roster before modifying the scene. Strict QA still requires every original.
            var originals=ModelPaths.Select(Load).ToArray();
            var models=new GameObject[ModelPaths.Length];
            var rows=new Placement[ModelPaths.Length];
            // Prefer already imported barrel/crate/wagon rather than another skinned chest.
            var fallback=new[]{5,1,0,4,3,2,6,8}.FirstOrDefault(i=>originals[i]!=null);
            for(int i=0;i<ModelPaths.Length;i++){
                int actual=i;
                if(!originals[i]){
                    if(!Candidate||!originals[fallback])throw new InvalidOperationException("Missing imported authored model: "+ModelPaths[i]);
                    actual=fallback;
                    Debug.LogWarning("OFFLINE_CANDIDATE_DECORATION_FALLBACK "+ModelPaths[i]+" -> "+ModelPaths[actual]);
                }
                models[i]=originals[actual];
                rows[i]=new Placement{requested=ModelPaths[i],actual=ModelPaths[actual]};
            }
            var holder=new GameObject("Authored medieval environment expansion (review only)");
            try{
                for(int i=0;i<models.Length;i++)for(int team=0;team<2;team++)
                    Place(models[i],holder.transform,team,3.2f,5+i*(OfflineBattle.Height-10)/8f,1.8f);
                // Preserve the six exterior lane decorations even if a banner needs a candidate substitute.
                for(int team=0;team<2;team++)foreach(float fraction in new[]{.19f,.5f,.81f})
                    Place(models[6],holder.transform,team,1.45f,OfflineBattle.Height*fraction,2.2f);
                resolved=rows;
                if(Candidate){
                    string report=Environment.GetEnvironmentVariable("BUKLOD_DECORATION_REPORT");
                    if(string.IsNullOrEmpty(report)||!Path.IsPathRooted(report))throw new InvalidOperationException("Candidate decoration receipt path missing.");
                    File.WriteAllText(report,JsonUtility.ToJson(new DecorationReport{status="OFFLINE_DECORATION_CANDIDATE",placements=rows,instances=24,productionApproved=false},true));
                }
            }catch{resolved=null;UnityEngine.Object.DestroyImmediate(holder);throw;}
            Debug.Log("BUKLOD authored environment expansion: 9 decoration slots, 24 exterior decorative instances; substitutions="+rows.Count(r=>r.actual!=r.requested));
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
            if(resolved==null||resolved.Length!=ModelPaths.Length)throw new UnityEditor.Build.BuildFailedException("Missing resolved authored decoration roster.");
            for(int i=0;i<ModelPaths.Length;i++){
                var row=resolved[i];
                if(row.requested!=ModelPaths[i]||!ModelPaths.Contains(row.actual)||(!Candidate&&row.actual!=row.requested)||!set.Contains(row.actual))
                    throw new UnityEditor.Build.BuildFailedException("Missing or invalid authored expansion scene dependency: "+row.requested+" -> "+row.actual);
            }
            foreach(var name in new[]{"light_03.png","magic_03.png"}){
                string p=Root+"vfx/addons/kenney_particle_pack/"+name;
                if(!set.Contains(p))throw new UnityEditor.Build.BuildFailedException("Missing authored particle texture: "+p);
            }
        }
    }
}
