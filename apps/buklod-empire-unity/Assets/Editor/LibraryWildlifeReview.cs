using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Deer and wolf keep their own authored skeletons and their original action clips.
    // No generic monster substitutions, simulation changes, or final visual approval.
    internal static class LibraryWildlifeReview {
        const string Source="Tools/AssetCandidates/LibraryFirst/Animals/";
        const string Out=CandidateReviewComposer.Out+"/LibraryFirst/";
        sealed class Spec {
            public WildernessKind kind;public string name,hash,attack;public int bytes;public Color tint;
            public Spec(WildernessKind k,string n,string h,int b,string a,Color c){kind=k;name=n;hash=h;bytes=b;attack=a;tint=c;}
        }
        static readonly Spec[] Specs={
            new Spec(WildernessKind.AzureStag,"Deer.glb","0c1a5a5d55ec13ca7899dd3a57256724cd9fca4e",662108,"Attack_Headbutt",new Color(.60f,.81f,1)),
            new Spec(WildernessKind.CrimsonWolf,"Wolf.glb","c54b02936167a3b0d9a7e8d467432ba4fa788d6b",608660,"Attack",new Color(1,.57f,.59f))
        };
        static string ModelPath(Spec s)=>Out+"Models/Animals/"+s.name;
        static string PrefabPath(Spec s)=>Out+"Prefabs/camp_"+s.kind+".prefab";
        static byte[] Read(Spec s){
            string file=Source+s.name;
            if(!File.Exists(file)||new FileInfo(file).Length!=s.bytes)throw new FileNotFoundException("Missing exact Library creature.",file);
            var bytes=File.ReadAllBytes(file);
            if(LibraryStructureReview.GitBlob(bytes)!=s.hash)throw new InvalidOperationException("Library creature identity mismatch: "+s.name);
            return bytes;
        }
        static AnimationClip Clip(AnimationClip[] clips,string sourceName,string slot,string asset){
            var matches=clips.Where(c=>string.Equals(c.name.Split('|').Last(),sourceName,StringComparison.Ordinal)).ToArray();
            if(matches.Length!=1)throw new InvalidOperationException("Missing or ambiguous original creature animation: "+sourceName);
            var clone=UnityEngine.Object.Instantiate(matches[0]);clone.name=slot;clone.legacy=false;
            var settings=AnimationUtility.GetAnimationClipSettings(clone);settings.loopTime=slot=="Idle"||slot=="Walk";AnimationUtility.SetAnimationClipSettings(clone,settings);
            var old=AssetDatabase.LoadAssetAtPath<AnimationClip>(asset);
            if(old){EditorUtility.CopySerialized(clone,old);UnityEngine.Object.DestroyImmediate(clone);return old;}
            AssetDatabase.CreateAsset(clone,asset);return clone;
        }
        static void Tint(GameObject model,Spec s){
            var cache=new Dictionary<Material,Material>();
            foreach(var renderer in model.GetComponentsInChildren<Renderer>(true)){
                var materials=renderer.sharedMaterials;
                for(int i=0;i<materials.Length;i++){
                    var original=materials[i];if(!original)continue;
                    if(!cache.TryGetValue(original,out var material)){
                        var clone=new Material(original);
                        foreach(var property in new[]{"_BaseColor","_BaseColorFactor","_Color"})if(clone.HasProperty(property)){
                            clone.SetColor(property,clone.GetColor(property)*s.tint);break;
                        }
                        string path=Out+"Materials/camp_"+s.kind+"_"+cache.Count+".mat";
                        material=AssetDatabase.LoadAssetAtPath<Material>(path);
                        if(material){EditorUtility.CopySerialized(clone,material);UnityEngine.Object.DestroyImmediate(clone);}
                        else{AssetDatabase.CreateAsset(clone,path);material=clone;}
                        cache.Add(original,material);
                    }
                    materials[i]=material;
                }
                renderer.sharedMaterials=materials;
            }
        }
        static GameObject Build(Spec s,GameObject reference){
            var source=AssetDatabase.LoadAssetAtPath<GameObject>(ModelPath(s));
            if(!source||!source.GetComponentInChildren<SkinnedMeshRenderer>(true)||!reference)throw new InvalidOperationException("Imported creature rig or footprint missing: "+s.name);
            var imported=AssetDatabase.LoadAllAssetsAtPath(ModelPath(s)).OfType<AnimationClip>().Where(c=>c.length>0).ToArray();
            var motions=new Dictionary<string,AnimationClip>(StringComparer.Ordinal);
            foreach(var pair in new[]{("Idle","Idle"),("Walk","Walk"),("Attack",s.attack),("Hit","Idle_HitReact_Left"),("Death","Death")}){
                motions.Add(pair.Item1,Clip(imported,pair.Item2,pair.Item1,Out+"Clips/camp_"+s.kind+"_"+pair.Item1+".anim"));
            }
            string controllerPath=Out+"Controllers/camp_"+s.kind+".controller";
            if(File.Exists(controllerPath))AssetDatabase.DeleteAsset(controllerPath);
            var controller=AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
            controller.AddParameter("Speed",AnimatorControllerParameterType.Float);
            var machine=controller.layers[0].stateMachine;var idle=machine.AddState("Idle");idle.motion=motions["Idle"];machine.defaultState=idle;
            foreach(string slot in new[]{"Attack","Hit","Death"}){
                controller.AddParameter(slot,AnimatorControllerParameterType.Trigger);
                var state=machine.AddState(slot);state.motion=motions[slot];
                var enter=machine.AddAnyStateTransition(state);enter.hasExitTime=false;enter.duration=.06f;enter.canTransitionToSelf=false;enter.AddCondition(AnimatorConditionMode.If,0,slot);
                if(slot!="Death"){var exit=state.AddTransition(idle);exit.hasExitTime=true;exit.exitTime=1;exit.duration=.1f;}
            }
            var old=UnityEngine.Object.Instantiate(reference);var root=new GameObject("Library_camp_"+s.kind);
            try{
                old.transform.position=Vector3.zero;old.transform.rotation=Quaternion.identity;
                var target=LibraryStructureReview.BoundsOf(old).size;
                var model=(GameObject)PrefabUtility.InstantiatePrefab(source,root.transform);
                if(!model)throw new InvalidOperationException("Unable to instantiate creature: "+s.name);
                if(PrefabUtility.IsPartOfPrefabInstance(model))PrefabUtility.UnpackPrefabInstance(model,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
                foreach(var anim in model.GetComponentsInChildren<Animation>(true))UnityEngine.Object.DestroyImmediate(anim);
                foreach(var anim in model.GetComponentsInChildren<Animator>(true))if(anim.gameObject!=model)UnityEngine.Object.DestroyImmediate(anim);
                var animator=model.GetComponent<Animator>();if(!animator)animator=model.AddComponent<Animator>();
                animator.runtimeAnimatorController=controller;animator.applyRootMotion=false;animator.cullingMode=AnimatorCullingMode.CullUpdateTransforms;
                Tint(model,s);
                var bounds=LibraryStructureReview.BoundsOf(model);
                float factor=Mathf.Min(target.x/bounds.size.x,target.z/bounds.size.z);
                if(bounds.size.y>.0001f&&target.y>.0001f)factor=Mathf.Min(factor,target.y/bounds.size.y);
                if(!LibraryStructureReview.Finite(factor)||factor<=0)throw new InvalidOperationException("Invalid creature dimensions: "+s.name);
                model.transform.localScale*=factor;bounds=LibraryStructureReview.BoundsOf(model);
                model.transform.position+=new Vector3(-bounds.center.x,-bounds.min.y,-bounds.center.z);
                foreach(var collider in model.GetComponentsInChildren<Collider>(true))collider.enabled=false;
                foreach(var skin in model.GetComponentsInChildren<SkinnedMeshRenderer>(true))skin.updateWhenOffscreen=false;
                var saved=PrefabUtility.SaveAsPrefabAsset(root,PrefabPath(s));
                if(!saved)throw new InvalidOperationException("Creature prefab save failed: "+s.name);
                EditorUtility.SetDirty(controller);EditorUtility.SetDirty(machine);return saved;
            }finally{UnityEngine.Object.DestroyImmediate(old);UnityEngine.Object.DestroyImmediate(root);}
        }
        internal static void Bind(BattleVisualCatalog catalog){
            foreach(var dir in new[]{"Models/Animals","Prefabs","Clips","Controllers","Materials"})Directory.CreateDirectory(Out+dir);
            foreach(var s in Specs){
                var bytes=Read(s);string dest=ModelPath(s);
                if(!File.Exists(dest)||LibraryStructureReview.GitBlob(File.ReadAllBytes(dest))!=s.hash)File.WriteAllBytes(dest,bytes);
            }
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            foreach(var s in Specs){
                var matches=catalog.wilderness.Where(x=>x.kind==s.kind).ToArray();
                if(matches.Length!=1)throw new InvalidOperationException("Missing canonical creature identity: "+s.kind);
                matches[0].prefab=Build(s,matches[0].prefab);
            }
            AssetDatabase.SaveAssets();
            Debug.Log("Library deer and wolf bound to AzureStag and CrimsonWolf. Remaining seven wilderness identities not replaced.");
        }
        internal static void ValidateDependencies(IEnumerable<string> dependencies){
            var set=new HashSet<string>(dependencies,StringComparer.Ordinal);
            foreach(var s in Specs){
                Read(s);
                if(!set.Contains(ModelPath(s))||!set.Contains(PrefabPath(s))||!File.Exists(ModelPath(s))||LibraryStructureReview.GitBlob(File.ReadAllBytes(ModelPath(s)))!=s.hash)
                    throw new BuildFailedException("Creature source/prefab dependency missing: "+s.kind);
                var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath(s));
                var animator=prefab?prefab.GetComponentInChildren<Animator>(true):null;
                if(!animator||!animator.runtimeAnimatorController||new[]{"Idle","Attack","Hit","Death"}.Any(n=>!animator.runtimeAnimatorController.animationClips.Any(c=>c&&c.name==n&&c.length>0)))
                    throw new BuildFailedException("Missing original creature action clips: "+s.kind);
            }
        }
    }
}
