using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
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
        static readonly string[] HeroClips={"Idle","Walk","Run","Attack","Skill","Primary","Secondary","Ultimate","LegacyUltimate","Hit","Death","Victory"};
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
            foreach(var team in new[]{"lux","tenebra"}){
                foreach(var id in Roles.Concat(team=="lux"?LuxVillagers:TenebraVillagers))
                    specs.Add((team+"_"+id,$"{Source}/rigged-factions/{team}_{id}.glb",FactionClips));
            }
            var staticSpecs=new[]{"genesis_rift_candidate","lux_tower_candidate","lux_core_candidate","tenebra_tower_candidate","tenebra_core_candidate"};
            foreach(var id in staticSpecs)specs.Add((id,$"{Candidate}/{(id=="genesis_rift_candidate"?"genesis_rift_detail_review":id)}.glb",Array.Empty<string>()));
            foreach(var spec in specs)if(!File.Exists(spec.path))
                throw new FileNotFoundException("Run Tools/prepare-review-assets.py first.",spec.path);
            Directory.CreateDirectory(Out+"/Models");Directory.CreateDirectory(Out+"/Prefabs");Directory.CreateDirectory(Out+"/Controllers");Directory.CreateDirectory(Out+"/Clips");
            foreach(var spec in specs)File.Copy(spec.path,$"{Out}/Models/{spec.id}.glb",true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var prefabs=new Dictionary<string,GameObject>();
            foreach(var spec in specs)prefabs.Add(spec.id,MakePrefab(spec.id,spec.clips));

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
        static GameObject MakePrefab(string id,string[] required){
            string modelPath=$"{Out}/Models/{id}.glb";
            var model=AssetDatabase.LoadAssetAtPath<GameObject>(modelPath);
            if(!model)throw new InvalidOperationException("glTFast GameObject import failed: "+id);
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
                        var clone=UnityEngine.Object.Instantiate(candidates[0]);clone.name=name;clone.legacy=false;
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
                    var idle=sm.AddState("Idle");idle.motion=clips["Idle"];sm.defaultState=idle;
                    var walk=sm.AddState("Walk");walk.motion=clips["Walk"];
                    var move=idle.AddTransition(walk);move.hasExitTime=false;move.duration=.12f;move.AddCondition(AnimatorConditionMode.Greater,.1f,"Speed");
                    var stop=walk.AddTransition(idle);stop.hasExitTime=false;stop.duration=.12f;stop.AddCondition(AnimatorConditionMode.Less,.1f,"Speed");
                    if(clips.TryGetValue("Run",out var runClip)){
                        var run=sm.AddState("Run");run.motion=runClip;
                        var fast=walk.AddTransition(run);fast.hasExitTime=false;fast.duration=.12f;fast.AddCondition(AnimatorConditionMode.Greater,4f,"Speed");
                        var slow=run.AddTransition(walk);slow.hasExitTime=false;slow.duration=.12f;slow.AddCondition(AnimatorConditionMode.Less,3.8f,"Speed");
                    }
                    foreach(var pair in clips.Where(c=>c.Key!="Idle"&&c.Key!="Walk"&&c.Key!="Run")){
                        controller.AddParameter(pair.Key,AnimatorControllerParameterType.Trigger);
                        var state=sm.AddState(pair.Key);state.motion=pair.Value;
                        var enter=sm.AddAnyStateTransition(state);enter.hasExitTime=false;enter.duration=.08f;enter.canTransitionToSelf=false;enter.AddCondition(AnimatorConditionMode.If,0,pair.Key);
                        var exit=state.AddTransition(idle);exit.hasExitTime=true;exit.exitTime=1;exit.duration=.1f;
                    }
                    foreach(var legacy in instance.GetComponentsInChildren<Animation>(true))UnityEngine.Object.DestroyImmediate(legacy);
                    var animator=instance.GetComponent<Animator>();if(!animator)animator=instance.AddComponent<Animator>();
                    animator.runtimeAnimatorController=controller;animator.applyRootMotion=false;
                }
                var saved=PrefabUtility.SaveAsPrefabAsset(instance,$"{Out}/Prefabs/{id}.prefab");
                if(!saved)throw new InvalidOperationException("Could not save "+id);
                return saved;
            }finally{UnityEngine.Object.DestroyImmediate(instance);}
        }
    }
}
