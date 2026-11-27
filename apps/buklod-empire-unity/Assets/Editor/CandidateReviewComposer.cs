using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Buklod.Empire.Editor {
    /// <summary>Editor-only art review; never sets build scenes, production catalog or approval.</summary>
    public static class CandidateReviewComposer {
        internal const string Out="Assets/Generated/ReviewOnly";
        const string Source="Tools/ReviewOutput";
        const string Candidate="Tools/AssetCandidates";
        internal static readonly string[] HeroClips={"Idle","Walk","Run","Attack","Skill","Primary","Secondary","Ultimate","LegacyUltimate","Hit","Death","Victory"};
        static readonly string[] FactionClips={"Idle","Walk","Attack","Work","Hit","Death"};
        internal static readonly string[] Roles={"infantry","siege","gunner","mage","healer"};
        internal static readonly string[] LuxVillagers={"aron","lira","daren","serah","kiel","miko"};
        internal static readonly string[] TenebraVillagers={"rogar","velin","kael","mora","zed","taro"};

        [MenuItem("BUKLOD Empire/Assemble unapproved 3D review scene")]
        public static void Prepare(){
            if(EditorSceneManager.GetActiveScene().isDirty)
                throw new InvalidOperationException("Save the open scene before assembling review.");
            var specs=new List<(string id,string path,string[] clips)>();
            foreach(var h in HeroKitCatalog.All)
                specs.Add((h.Id,$"{Source}/heroes/{h.Id}.glb",HeroClips));
            var factionPaths=FactionSources();
            foreach(var team in new[]{"lux","tenebra"}){
                foreach(var id in Roles.Concat(team=="lux"?LuxVillagers:TenebraVillagers))
                    specs.Add((team+"_"+id,factionPaths[team+"_"+id],FactionClips));
            }
            var staticSpecs=new[]{"genesis_rift_candidate","lux_tower_candidate","lux_core_candidate","tenebra_tower_candidate","tenebra_core_candidate"};
            foreach(var id in staticSpecs)specs.Add((id,id=="genesis_rift_candidate"?EnvironmentSource():$"{Candidate}/{id.Replace("_candidate","_architecture_review")}.glb",Array.Empty<string>()));
            foreach(var spec in specs)if(!File.Exists(spec.path))
                throw new FileNotFoundException("Run Tools/prepare-review-assets.py first.",spec.path);
            Directory.CreateDirectory(Out+"/Models");Directory.CreateDirectory(Out+"/Prefabs");Directory.CreateDirectory(Out+"/Controllers");Directory.CreateDirectory(Out+"/Clips");
            bool factionHd=FactionMaterialReview.Prepare(factionPaths.Values.All(path=>path.StartsWith(Source+"/premium-factions/",StringComparison.Ordinal)));
            foreach(var spec in specs)File.Copy(spec.path,$"{Out}/Models/{spec.id}.glb",true);
            HeroLodReviewImporter.CopyModels();
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var prefabs=new Dictionary<string,GameObject>();
            bool environmentHd=EnvironmentMaterialReview.Prepare();
            foreach(var spec in specs)prefabs.Add(spec.id,MakePrefab(spec.id,spec.clips,factionHd&&factionPaths.ContainsKey(spec.id),environmentHd:environmentHd&&staticSpecs.Contains(spec.id)));

            var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            var root=new GameObject("UNAPPROVED — ORIGINAL PROCEDURAL REVIEW");
            // Art gallery rather than the production battlefield; separate map prefab can be inspected.
            var actors=specs.Where(s=>s.clips.Length>0).Select(s=>s.id).ToArray();
            for(int i=0;i<actors.Length;i++){
                var instance=(GameObject)PrefabUtility.InstantiatePrefab(prefabs[actors[i]],scene);
                instance.transform.SetParent(root.transform,false);
                instance.transform.position=new Vector3((i%7)*3.8f,0,(i/7)*4.4f);
            }
            var ground=GameObject.CreatePrimitive(PrimitiveType.Plane);ground.name="Review floor";ground.transform.position=new Vector3(11.4f,-.02f,8.8f);ground.transform.localScale=new Vector3(3,1,2.4f);
            var light=new GameObject("Review light",typeof(Light)).GetComponent<Light>();light.type=LightType.Directional;light.intensity=1.4f;light.transform.rotation=Quaternion.Euler(45,-30,0);
            var camera=new GameObject("Review camera",typeof(Camera)).GetComponent<Camera>();camera.transform.position=new Vector3(11.4f,20,-17);camera.transform.LookAt(new Vector3(11.4f,0,8.8f));camera.orthographic=true;camera.orthographicSize=16;camera.farClipPlane=120;
            if(!EditorSceneManager.SaveScene(scene,Out+"/AssetReview.unity"))
                throw new InvalidOperationException("Review scene not saved.");
            AssetDatabase.SaveAssets();
            Debug.Log("35 candidate actor prefabs and 5 static prefabs imported; review scene saved outside production. Visual and deformation review remain required.");
        }
        [Serializable] private sealed class FactionReceipt {public string status;public FactionRow[] models;}
        [Serializable] private sealed class FactionRow {public string id,file,sourceSha256,sha256;public int bytes,addedTriangles;}
        static Dictionary<string,string> FactionSources(){
            var map=new Dictionary<string,string>(StringComparer.Ordinal);
            foreach(var team in new[]{"lux","tenebra"})foreach(var id in Roles.Concat(team=="lux"?LuxVillagers:TenebraVillagers))
                map.Add(team+"_"+id,Source+"/rigged-factions/"+team+"_"+id+".glb");
            string dir=Source+"/premium-factions",receipt=dir+"/manifest.json";
            if(!Directory.Exists(dir))return map;
            if(!File.Exists(receipt))throw new InvalidOperationException("Incomplete premium faction generation.");
            var doc=JsonUtility.FromJson<FactionReceipt>(File.ReadAllText(receipt));
            if(doc==null||doc.status!="REVIEW_ONLY"||doc.models==null||doc.models.Length!=map.Count)
                throw new InvalidOperationException("Invalid premium faction manifest.");
            var seen=new HashSet<string>(StringComparer.Ordinal);
            foreach(var row in doc.models){
                if(row==null||string.IsNullOrEmpty(row.id)||!map.ContainsKey(row.id)||!seen.Add(row.id)||row.file!=row.id+".glb"||row.addedTriangles<200)
                    throw new InvalidOperationException("Invalid faction identity.");
                string path=dir+"/"+row.file;
                if(!File.Exists(path)||!File.Exists(map[row.id])||new FileInfo(path).Length!=row.bytes||
                   FileHash(path)!=row.sha256||FileHash(map[row.id])!=row.sourceSha256)
                    throw new InvalidOperationException("Faction model hash mismatch: "+row.id);
                map[row.id]=path;
            }
            return map;
        }
        [Serializable] private sealed class EnvironmentReceipt {public string status,sourceSha256,sha256;public int bytes;}
        static string FileHash(string path){
            using(var stream=File.OpenRead(path))using(var sha=SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","").ToLowerInvariant();
        }
        static string EnvironmentSource(){
            string original=Candidate+"/genesis_rift_environment_review.glb";
            string premium=Source+"/environment/genesis_rift_premium_review.glb";
            string receipt=Source+"/environment/manifest.json";
            if(!File.Exists(premium)&&!File.Exists(receipt))return original;
            if(!File.Exists(premium)||!File.Exists(receipt))throw new InvalidOperationException("Incomplete premium map. Regenerate premium-environment-review.mjs.");
            var row=JsonUtility.FromJson<EnvironmentReceipt>(File.ReadAllText(receipt));
            if(row==null||row.status!="REVIEW_ONLY"||row.bytes!=new FileInfo(premium).Length||FileHash(premium)!=row.sha256||FileHash(original)!=row.sourceSha256)
                throw new InvalidOperationException("Premium map integrity mismatch. Regenerate from the current original map.");
            return premium;
        }
        internal static GameObject MakePrefab(string id,string[] required,bool factionHd=false,bool wildlifeHd=false,bool environmentHd=false){
            string modelPath=$"{Out}/Models/{id}.glb";
            var model=AssetDatabase.LoadAssetAtPath<GameObject>(modelPath);
            if(!model){
                // A missing cached main object is not evidence of malformed GLB. Retry once with a synchronous forced import.
                Debug.LogWarning("Missing imported GameObject; forcing one reimport: "+modelPath);
                AssetDatabase.ImportAsset(modelPath,ImportAssetOptions.ForceUpdate|ImportAssetOptions.ForceSynchronousImport);
                model=AssetDatabase.LoadAssetAtPath<GameObject>(modelPath);
            }
            if(!model){
                var importer=AssetImporter.GetAtPath(modelPath);
                var loaded=AssetDatabase.LoadAllAssetsAtPath(modelPath).Where(a=>a).Select(a=>a.GetType().Name+":"+a.name);
                throw new InvalidOperationException("glTFast GameObject import failed: "+id+"; path="+modelPath+"; importer="+(importer?importer.GetType().FullName:"missing")+"; imported objects="+string.Join(", ",loaded));
            }
            // Unpack a temporary instance so Animator replacement cannot mutate imported model assets.
            var instance=(GameObject)PrefabUtility.InstantiatePrefab(model);
            if(!instance)throw new InvalidOperationException("Could not instantiate "+id);
            try{
                if(PrefabUtility.IsPartOfPrefabInstance(instance))
                    PrefabUtility.UnpackPrefabInstance(instance,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
                if(required.Length>0){
                    if(!instance.GetComponentInChildren<SkinnedMeshRenderer>(true))
                        throw new InvalidOperationException("Skinned mesh missing: "+id);
                    var imported=AssetDatabase.LoadAllAssetsAtPath(modelPath).OfType<AnimationClip>().Where(c=>c.length>0).ToArray();
                    var clips=new Dictionary<string,AnimationClip>();
                    foreach(var name in required){
                        var candidates=imported.Where(c=>c.name==name).ToArray();
                        if(candidates.Length!=1)throw new InvalidOperationException("Expected one imported clip: "+id+"/"+name);
                        string clipPath=$"{Out}/Clips/{id}_{name}.anim";
                        var clone= name=="Attack"&&HeroKitCatalog.All.Any(h=>h.Id==id)
                            ?ReviewWeaponMotion.Bake(instance,id,candidates[0])
                            :UnityEngine.Object.Instantiate(candidates[0]);
                        clone.name=name;clone.legacy=false;
                        if(HeroKitCatalog.All.Any(h=>h.Id==id)&&(name=="Idle"||name=="Walk"||name=="Run"))ReviewSecondaryMotion.Bake(instance,clone,name);
                        var settings=AnimationUtility.GetAnimationClipSettings(clone);settings.loopTime=name=="Idle"||name=="Walk"||name=="Run";AnimationUtility.SetAnimationClipSettings(clone,settings);
                        var clip=AssetDatabase.LoadAssetAtPath<AnimationClip>(clipPath);
                        if(clip){EditorUtility.CopySerialized(clone,clip);UnityEngine.Object.DestroyImmediate(clone);}
                        else{AssetDatabase.CreateAsset(clone,clipPath);clip=clone;}
                        clips.Add(name,clip);
                    }
                    string controllerPath=$"{Out}/Controllers/{id}.controller";
                    if(File.Exists(controllerPath))AssetDatabase.DeleteAsset(controllerPath);
                    var controller=AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
                    controller.AddParameter("Speed",AnimatorControllerParameterType.Float);
                    var sm=controller.layers[0].stateMachine;
                    var idle=sm.AddState("Locomotion");sm.defaultState=idle;
                    var blend=new BlendTree{name="Idle / walk / run",blendType=BlendTreeType.Simple1D,blendParameter="Speed",useAutomaticThresholds=false};
                    AssetDatabase.AddObjectToAsset(blend,controller);
                    blend.AddChild(clips["Idle"],0f);
                    blend.AddChild(clips["Walk"],2.5f);
                    if(clips.TryGetValue("Run",out var runClip))blend.AddChild(runClip,5.5f);
                    idle.motion=blend;
                    foreach(var pair in clips.Where(c=>c.Key!="Idle"&&c.Key!="Walk"&&c.Key!="Run")){
                        controller.AddParameter(pair.Key,AnimatorControllerParameterType.Trigger);
                        var state=sm.AddState(pair.Key);state.motion=pair.Value;
                        var enter=sm.AddAnyStateTransition(state);enter.hasExitTime=false;enter.duration=.08f;enter.canTransitionToSelf=false;enter.AddCondition(AnimatorConditionMode.If,0,pair.Key);
                        if(pair.Key!="Death"){var exit=state.AddTransition(idle);exit.hasExitTime=true;exit.exitTime=1;exit.duration=.12f;}
                    }
                    foreach(var legacy in instance.GetComponentsInChildren<Animation>(true))UnityEngine.Object.DestroyImmediate(legacy);
                    var animator=instance.GetComponent<Animator>();if(!animator)animator=instance.AddComponent<Animator>();
                    animator.runtimeAnimatorController=controller;animator.applyRootMotion=false;
                }
                if(factionHd)FactionMaterialReview.Apply(instance,id);
                if(wildlifeHd)WildlifeMaterialReview.Apply(instance,id);
                if(environmentHd)EnvironmentMaterialReview.Apply(instance,id);
                if(id=="economy_lux_farm"||id=="economy_tenebra_farm"){
                    var crop=instance.GetComponentsInChildren<Transform>(true).Where(t=>t.name=="review_crop_canopy").ToArray();
                    if(crop.Length!=1)throw new InvalidOperationException("Regenerate economy models: farm crop canopy missing or duplicated.");
                    instance.AddComponent<ReviewFarmGrowth>().Configure(crop[0]);
                }
                if(HeroKitCatalog.All.Any(h=>h.Id==id)){HeroLodReviewImporter.Attach(instance,id);ReviewEquipmentComposer.Attach(instance);}
                var saved=PrefabUtility.SaveAsPrefabAsset(instance,$"{Out}/Prefabs/{id}.prefab");
                if(!saved)throw new InvalidOperationException("Could not save "+id);
                return saved;
            }finally{UnityEngine.Object.DestroyImmediate(instance);}
        }
    }
}
