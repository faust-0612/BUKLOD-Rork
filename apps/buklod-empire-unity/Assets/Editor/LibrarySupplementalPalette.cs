using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Source-backed optional model palette. It is deliberately outside Resources
    // and the playable catalog until an exact identity and motion contract are approved.
    internal static class LibrarySupplementalPalette {
        const string Source="Tools/AssetCandidates/LibraryFirst/";
        const string Out=CandidateReviewComposer.Out+"/SupplementalPalette/";
        [Serializable] sealed class Row {public string source,name,gitBlob;public int bytes,clips;}
        [Serializable] sealed class Manifest {public string status,author,license;public bool releaseApproved;public Row[] models;}
        static readonly Dictionary<string,string[]> Expected=new Dictionary<string,string[]>(StringComparer.Ordinal){
            {"Monsters/quaternius-green-blob.glb",new[]{"Idle","Walk","Bite_Front","HitRecieve","Death"}},
            {"Monsters/quaternius-demon.glb",new[]{"Flying_Idle"}},
            {"Monsters/quaternius-yeti.glb",new[]{"Idle","Walk","Bite_Front","HitRecieve","Death"}},
            {"Monsters/quaternius-orc.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Monsters/quaternius-orc-skull.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Monsters/quaternius-alien.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Monsters/quaternius-mushroom-king.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Monsters/quaternius-blue-demon.glb",new[]{"Idle","Walk","Punch","HitReact","Death"}},
            {"Enemies/Snake.glb",new[]{"Snake_Idle","Snake_Walk","Snake_Attack","Snake_Jump"}}
        };
        static string Key(Row row)=>row.source+"/"+row.name;
        static bool SafeName(string name)=>!string.IsNullOrWhiteSpace(name)&&name==Path.GetFileName(name)&&name.EndsWith(".glb",StringComparison.Ordinal)&&!name.Contains("/")&&!name.Contains("\\")&&!name.Contains(":");
        static bool Finite(float value)=>!float.IsNaN(value)&&!float.IsInfinity(value);
        static bool Finite(Vector3 value)=>Finite(value.x)&&Finite(value.y)&&Finite(value.z);
        // Validate original skeletal curves and baked deformation before making a review prefab.
        static void Sample(GameObject source,AnimationClip clip,string key){
            var instance=UnityEngine.Object.Instantiate(source);
            var mesh=new Mesh();
            try{
                var skins=instance.GetComponentsInChildren<SkinnedMeshRenderer>(true);
                if(skins.Length==0||skins.Any(x=>!x.sharedMesh||x.sharedMesh.vertexCount==0))
                    throw new InvalidOperationException("Invalid supplemental skin: "+key);
                var bindings=AnimationUtility.GetCurveBindings(clip).Where(x=>x.type==typeof(Transform)).ToArray();
                if(bindings.Length==0||bindings.Any(x=>!string.IsNullOrEmpty(x.path)&&!instance.transform.Find(x.path)))
                    throw new InvalidOperationException("Unbound supplemental rig curves: "+key+"/"+clip.name);
                var nodes=instance.GetComponentsInChildren<Transform>(true);
                var pos=nodes.Select(x=>x.localPosition).ToArray();
                var rot=nodes.Select(x=>x.localRotation).ToArray();
                var scale=nodes.Select(x=>x.localScale).ToArray();
                foreach(float fraction in new[]{0f,.5f,.99f}){
                    for(int i=0;i<nodes.Length;i++){nodes[i].localPosition=pos[i];nodes[i].localRotation=rot[i];nodes[i].localScale=scale[i];}
                    clip.SampleAnimation(instance,clip.length*fraction);
                    foreach(var skin in skins){
                        mesh.Clear();skin.BakeMesh(mesh);mesh.RecalculateBounds();
                        if(mesh.vertexCount!=skin.sharedMesh.vertexCount||!Finite(mesh.bounds.center)||!Finite(mesh.bounds.size)||mesh.bounds.size.sqrMagnitude<=.000001f)
                            throw new InvalidOperationException("Invalid sampled supplemental mesh: "+key+"/"+clip.name);
                    }
                }
            }finally{UnityEngine.Object.DestroyImmediate(mesh);UnityEngine.Object.DestroyImmediate(instance);}
        }
        // Build isolated review prefabs, never alter the canonical wilderness catalog.
        static void BuildCombatPrefab(GameObject source,AnimationClip[] imported,string key){
            var required=Expected[key];
            if(required.Length!=5)return; // No invented hit/death clips for incomplete rigs.
            string id=Path.GetFileNameWithoutExtension(key);
            string folder=Out+"CombatPrefabs/";
            Directory.CreateDirectory(folder);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var slots=new[]{"Idle","Walk","Attack","Hit","Death"};
            var clips=new AnimationClip[slots.Length];
            for(int i=0;i<slots.Length;i++){
                var original=imported.Single(c=>c.name.Split('|').Last()==required[i]);
                var copy=UnityEngine.Object.Instantiate(original);
                copy.name=slots[i];copy.legacy=false;
                var settings=AnimationUtility.GetAnimationClipSettings(copy);
                settings.loopTime=i<2;AnimationUtility.SetAnimationClipSettings(copy,settings);
                string path=folder+id+"_"+slots[i]+".anim";
                var existing=AssetDatabase.LoadAssetAtPath<AnimationClip>(path);
                if(existing){EditorUtility.CopySerialized(copy,existing);UnityEngine.Object.DestroyImmediate(copy);clips[i]=existing;}
                else{AssetDatabase.CreateAsset(copy,path);clips[i]=copy;}
            }
            string controllerPath=folder+id+".controller";
            if(AssetDatabase.LoadAssetAtPath<AnimatorController>(controllerPath))AssetDatabase.DeleteAsset(controllerPath);
            var controller=AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
            controller.AddParameter("Speed",AnimatorControllerParameterType.Float);
            var machine=controller.layers[0].stateMachine;
            var idle=machine.AddState("Locomotion");machine.defaultState=idle;
            var blend=new BlendTree{name="Authored locomotion",blendType=BlendTreeType.Simple1D,blendParameter="Speed",useAutomaticThresholds=false};
            AssetDatabase.AddObjectToAsset(blend,controller);
            blend.AddChild(clips[0],0);blend.AddChild(clips[1],1);idle.motion=blend;
            // Death has transition priority over attack or hit.
            foreach(int i in new[]{4,2,3}){
                controller.AddParameter(slots[i],AnimatorControllerParameterType.Trigger);
                var state=machine.AddState(slots[i]);state.motion=clips[i];
                var enter=machine.AddAnyStateTransition(state);enter.hasExitTime=false;enter.duration=.05f;enter.canTransitionToSelf=false;
                enter.AddCondition(AnimatorConditionMode.If,0,slots[i]);
                if(i!=4){var exit=state.AddTransition(idle);exit.hasExitTime=true;exit.exitTime=1;exit.duration=.1f;}
            }
            var instance=UnityEngine.Object.Instantiate(source);
            try{
                foreach(var legacy in instance.GetComponentsInChildren<Animation>(true))UnityEngine.Object.DestroyImmediate(legacy);
                foreach(var nested in instance.GetComponentsInChildren<Animator>(true))if(nested.gameObject!=instance)UnityEngine.Object.DestroyImmediate(nested);
                var animator=instance.GetComponent<Animator>();if(!animator)animator=instance.AddComponent<Animator>();
                animator.runtimeAnimatorController=controller;animator.applyRootMotion=false;
                foreach(var collider in instance.GetComponentsInChildren<Collider>(true))collider.enabled=false;
                if(!PrefabUtility.SaveAsPrefabAsset(instance,folder+id+".prefab"))throw new InvalidOperationException("Supplemental prefab save failed: "+key);
                EditorUtility.SetDirty(controller);EditorUtility.SetDirty(machine);
            }finally{UnityEngine.Object.DestroyImmediate(instance);}
        }
        internal static void BindHazards(BattleVisualCatalog catalog){
            Prepare();
            catalog.jungleDemon=BuildHazard("Monsters/quaternius-demon.glb",true);
            catalog.jungleSnake=BuildHazard("Enemies/Snake.glb",false);
        }
        static GameObject BuildHazard(string key,bool demon){
            string folder=Out+"Hazards/";Directory.CreateDirectory(folder);AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            string modelPath=Out+"Models/"+key;
            var source=AssetDatabase.LoadAssetAtPath<GameObject>(modelPath);
            var imported=AssetDatabase.LoadAllAssetsAtPath(modelPath).OfType<AnimationClip>().ToArray();
            string id=demon?"Demon":"Snake",path=folder+id+".controller";
            if(AssetDatabase.LoadAssetAtPath<AnimatorController>(path))AssetDatabase.DeleteAsset(path);
            var controller=AnimatorController.CreateAnimatorControllerAtPath(path);
            var machine=controller.layers[0].stateMachine;
            var names=demon?new[]{"Flying_Idle"}:new[]{"Snake_Idle","Snake_Walk","Snake_Attack"};
            var clips=new AnimationClip[names.Length];
            for(int i=0;i<names.Length;i++){
                var clone=UnityEngine.Object.Instantiate(imported.Single(c=>c.name.Split('|').Last()==names[i]));clone.legacy=false;
                var settings=AnimationUtility.GetAnimationClipSettings(clone);settings.loopTime=i<2;AnimationUtility.SetAnimationClipSettings(clone,settings);
                string clipPath=folder+id+"_"+names[i]+".anim";var old=AssetDatabase.LoadAssetAtPath<AnimationClip>(clipPath);
                if(old){EditorUtility.CopySerialized(clone,old);UnityEngine.Object.DestroyImmediate(clone);clips[i]=old;}else{AssetDatabase.CreateAsset(clone,clipPath);clips[i]=clone;}
            }
            AnimationClip SaveOriginal(string action){
                var clip=ReviewHazardMotion.Create(source,demon,action);
                string clipPath=folder+id+"_Original_"+action+".anim";
                var old=AssetDatabase.LoadAssetAtPath<AnimationClip>(clipPath);
                if(!old){AssetDatabase.CreateAsset(clip,clipPath);return clip;}
                EditorUtility.CopySerialized(clip,old);
                UnityEngine.Object.DestroyImmediate(clip);
                EditorUtility.SetDirty(old);
                return old;
            }
            var idle=machine.AddState("Patrol");machine.defaultState=idle;
            controller.AddParameter("Speed",AnimatorControllerParameterType.Float);
            var blend=new BlendTree{name="Hazard movement",blendType=BlendTreeType.Simple1D,blendParameter="Speed",useAutomaticThresholds=false};
            AssetDatabase.AddObjectToAsset(blend,controller);
            blend.AddChild(clips[0],0);
            blend.AddChild(demon?SaveOriginal("Move"):clips[1],1);
            idle.motion=blend;
            foreach(string action in new[]{"Death","Hit","Attack"}){
                controller.AddParameter(action,AnimatorControllerParameterType.Trigger);
                var state=machine.AddState(action);
                state.motion=!demon&&action=="Attack"?clips[2]:SaveOriginal(action);
                var enter=machine.AddAnyStateTransition(state);
                enter.hasExitTime=false;enter.duration=.04f;enter.canTransitionToSelf=false;
                enter.AddCondition(AnimatorConditionMode.If,0,action);
                if(action!="Death"){
                    var exit=state.AddTransition(idle);
                    exit.hasExitTime=true;exit.exitTime=1;exit.duration=.08f;
                }
            }
            var instance=UnityEngine.Object.Instantiate(source);
            try{
                foreach(var legacy in instance.GetComponentsInChildren<Animation>(true))UnityEngine.Object.DestroyImmediate(legacy);
                foreach(var nested in instance.GetComponentsInChildren<Animator>(true))if(nested.gameObject!=instance)UnityEngine.Object.DestroyImmediate(nested);
                var animator=instance.GetComponent<Animator>();if(!animator)animator=instance.AddComponent<Animator>();
                animator.runtimeAnimatorController=controller;animator.applyRootMotion=false;
                foreach(var collider in instance.GetComponentsInChildren<Collider>(true))collider.enabled=false;
                var bounds=LibraryStructureReview.BoundsOf(instance);float size=Mathf.Max(bounds.size.x,bounds.size.y,bounds.size.z);
                if(!Finite(size)||size<=.001f)throw new InvalidOperationException("Invalid hazard size: "+id);
                instance.transform.localScale*= (demon?4f:3f)/size;
                var prefab=PrefabUtility.SaveAsPrefabAsset(instance,folder+id+".prefab");if(!prefab)throw new InvalidOperationException("Hazard prefab failed: "+id);
                EditorUtility.SetDirty(controller);EditorUtility.SetDirty(machine);AssetDatabase.SaveAssets();return prefab;
            }finally{UnityEngine.Object.DestroyImmediate(instance);}
        }
        [MenuItem("BUKLOD Empire/Import supplemental authored creature palette")]
        public static void Prepare(){
            if(Application.isPlaying)throw new InvalidOperationException("Exit play mode first.");
            var doc=JsonUtility.FromJson<Manifest>(File.ReadAllText(Source+"manifest.json"));
            if(doc==null||doc.status!="LICENSED_SOURCE_CANDIDATES_ONLY"||doc.author!="Quaternius"||doc.license!="CC0-1.0"||doc.releaseApproved||doc.models==null)
                throw new InvalidOperationException("Invalid supplemental provenance.");
            var rows=doc.models.Where(r=>r!=null&&Expected.ContainsKey(Key(r))).ToArray();
            if(rows.Length!=Expected.Count||rows.Select(Key).Distinct(StringComparer.Ordinal).Count()!=Expected.Count)
                throw new InvalidOperationException("Incomplete supplemental model roster.");
            var verified=new Dictionary<string,byte[]>(StringComparer.Ordinal);
            foreach(var row in rows){
                if(!SafeName(row.name)||row.bytes<=0||row.bytes>16*1024*1024)throw new InvalidOperationException("Invalid model path or size.");
                var data=File.ReadAllBytes(Source+Key(row));
                if(data.Length!=row.bytes||LibraryStructureReview.GitBlob(data)!=row.gitBlob)
                    throw new InvalidOperationException("Changed supplemental model: "+Key(row));
                verified.Add(Key(row),data);
            }
            foreach(var pair in verified){
                string path=Out+"Models/"+pair.Key;Directory.CreateDirectory(Path.GetDirectoryName(path));
                if(!File.Exists(path)||LibraryStructureReview.GitBlob(File.ReadAllBytes(path))!=LibraryStructureReview.GitBlob(pair.Value))
                    File.WriteAllBytes(path,pair.Value);
            }
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            foreach(var row in rows){
                string modelPath=Out+"Models/"+Key(row);
                var model=AssetDatabase.LoadAssetAtPath<GameObject>(modelPath);
                if(!model||!model.GetComponentInChildren<SkinnedMeshRenderer>(true))throw new InvalidOperationException("Missing imported rig: "+row.name);
                var imported=AssetDatabase.LoadAllAssetsAtPath(modelPath).OfType<AnimationClip>().Where(c=>c.length>0).ToArray();
                foreach(var expected in Expected[Key(row)]){
                    var matches=imported.Where(c=>c.name.Split('|').Last()==expected).ToArray();
                    if(matches.Length!=1||!Finite(matches[0].length))
                        throw new InvalidOperationException("Missing or ambiguous supplemental animation: "+row.name+"/"+expected);
                    Sample(model,matches[0],Key(row));
                }
                BuildCombatPrefab(model,imported,Key(row));
                // Preserve the complete authored model and clips. No fabricated combat motions.
                Debug.Log("Supplemental source ready for visual review: "+row.name+" ("+imported.Length+" clips)");
            }
            AssetDatabase.SaveAssets();
            Debug.Log("Nine supplemental source rigs sampled; seven complete combat review prefabs prepared. No gameplay replacement or release approval.");
        }
    }
}
