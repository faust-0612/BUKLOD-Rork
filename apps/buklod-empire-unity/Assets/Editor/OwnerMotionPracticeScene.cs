using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;

namespace Buklod.Empire.Editor {
    // Real offline combat scene, not a gallery. Provisional mechanical mappings do not
    // declare final hero identity, rights, or release approval.
    public static class OwnerMotionPracticeScene {
        const string Source="Tools/ReviewOutput/owner-motion-candidates/models";
        const string Root="Assets/Generated/ReviewOnly/OwnerMotionPractice";
        public const string ScenePath=Root+"/OwnerMotionPractice.unity";
        static readonly int[] Budgets={36000,14000,5000};
        sealed class Spec {
            public readonly string Hero,Model;public readonly string[] Hashes;
            public Spec(string hero,string model,params string[] hashes){Hero=hero;Model=model;Hashes=hashes;}
        }
        static readonly Spec[] Specs={
            new Spec("niel","azure-champion","c7f9f43b0cd96b6c7154d497f19f3237a96da6a370470c61bd6b8e378e98d804","610b012eb06fc86c731c3db43d48e2d7b96b17cffbe4b2b0eb84a4324bc58cd9","c7790446bd5c778840e091b1b82bfb74e94b03d8004f7fc80a486cbde0465a9c"),
            new Spec("van","t1-sentinel","7eec2e49d331a069095771b1ebce78cdead20643e81b79ee1c3d97df8b4a7eb7","a981d09f13b070e3e2b38efacf2e89f8a78c099098b56832628a861c85804a2c","e6b2f35ae214a3f51922eddbe0309af73095cc27976c5e334961301e1a7941b0"),
            new Spec("phan","hooded-blade","6c6d3528f6f827eb4eafe0a5df49ce6592a425ff0c0429a031e1ea63578e3978","22ea0fdab536164c8bed685c44c288b9c9e3de3ae794d6d1604a936158bb29af","9d94d7f0f9c5ddbea59e39b3c5496ed4dc4463c6d02a3860e7c10080fd9120d2")
        };
        public static bool IsPrivatePath(string path)=>!string.IsNullOrEmpty(path)&&
            (path.StartsWith(Root+"/",StringComparison.OrdinalIgnoreCase)||path.StartsWith("Assets/Generated/ReviewOnly/OwnerHeroStudio/",StringComparison.OrdinalIgnoreCase));
        static string FileName(Spec s,int i)=>s.Model+"-lod"+Budgets[i]+"-motion.glb";
        static string Model(Spec s,int i)=>Root+"/Models/"+FileName(s,i);
        static string Hash(string path){
            using(var f=File.OpenRead(path))using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(f)).Replace("-","").ToLowerInvariant();
        }
        static void VerifyInputs(){
            foreach(var s in Specs)for(int i=0;i<Budgets.Length;i++){
                string p=Source+"/"+FileName(s,i);
                if(!File.Exists(p)||Hash(p)!=s.Hashes[i])throw new InvalidOperationException("Missing or changed private motion asset: "+p);
            }
        }
        static SkinnedMeshRenderer Skin(GameObject go,int budget){
            if(!go)throw new InvalidOperationException("Missing glTFast model.");
            var skins=go.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            if(skins.Length!=1||!skins[0].sharedMesh||skins[0].bones.Length!=22||skins[0].bones.Any(x=>!x))
                throw new InvalidOperationException("Actual 22-joint skin required.");
            var m=skins[0].sharedMesh;ulong n=0;
            for(int i=0;i<m.subMeshCount;i++){if(m.GetTopology(i)!=MeshTopology.Triangles)throw new InvalidOperationException("Invalid mesh topology.");n+=m.GetIndexCount(i)/3;}
            if(n!=(ulong)budget)throw new InvalidOperationException("Private candidate triangle count mismatch.");
            return skins[0];
        }
        static Transform Map(Transform source,Transform low,Transform high){
            if(!source||!(source==low||source.IsChildOf(low)))throw new InvalidOperationException("LOD source outside rig.");
            string path=AnimationUtility.CalculateTransformPath(source,low);
            var dest=string.IsNullOrEmpty(path)?high:high.Find(path);
            if(!dest)throw new InvalidOperationException("Missing equivalent LOD bone: "+path);
            return dest;
        }
        static Renderer AttachLod(GameObject high,SkinnedMeshRenderer primary,GameObject low,int budget){
            var src=Skin(low,budget);var a=primary.sharedMesh.bindposes;var b=src.sharedMesh.bindposes;
            if(a.Length!=b.Length||src.sharedMesh.subMeshCount!=primary.sharedMesh.subMeshCount)throw new InvalidOperationException("LOD bind layout mismatch.");
            for(int i=0;i<a.Length;i++)for(int k=0;k<16;k++)if(Mathf.Abs(a[i][k]-b[i][k])>.0001f)throw new InvalidOperationException("LOD bind pose drift.");
            var bones=src.bones.Select(x=>Map(x,low.transform,high.transform)).ToArray();
            if(!bones.SequenceEqual(primary.bones))throw new InvalidOperationException("LOD bone order mismatch.");
            var go=new GameObject("Private LOD "+budget);go.transform.SetParent(primary.transform,false);
            var r=go.AddComponent<SkinnedMeshRenderer>();r.sharedMesh=src.sharedMesh;r.sharedMaterials=primary.sharedMaterials;
            r.bones=bones;r.rootBone=src.rootBone?Map(src.rootBone,low.transform,high.transform):null;
            if(r.rootBone!=primary.rootBone)throw new InvalidOperationException("LOD root drift.");
            r.localBounds=src.localBounds;r.updateWhenOffscreen=false;r.quality=primary.quality;r.shadowCastingMode=ShadowCastingMode.On;r.receiveShadows=true;
            return r;
        }
        static AnimatorController Controller(Spec s,GameObject model){
            string p=Root+"/Controllers/"+s.Model+".controller";
            var existing=AssetDatabase.LoadAssetAtPath<AnimatorController>(p);
            if(existing)AssetDatabase.DeleteAsset(p);
            var c=AnimatorController.CreateAnimatorControllerAtPath(p);
            var source=AssetDatabase.LoadAllAssetsAtPath(Model(s,0)).OfType<AnimationClip>().Where(x=>x&&x.length>0).ToArray();
            var clips=new Dictionary<string,AnimationClip>(StringComparer.Ordinal);
            foreach(var name in CandidateReviewComposer.HeroClips){
                var found=source.Where(x=>x.name==name).ToArray();
                if(found.Length!=1)throw new InvalidOperationException("Missing exact candidate motion "+s.Model+"/"+name);
                var clip=UnityEngine.Object.Instantiate(found[0]);clip.name=name;clip.legacy=false;
                CombatMotionBaker.Apply(clip,s.Hero,name);
                var bindings=AnimationUtility.GetCurveBindings(clip).Where(x=>x.type==typeof(Transform)).ToArray();
                if(bindings.Length==0||bindings.Any(x=>!string.IsNullOrEmpty(x.path)&&!model.transform.Find(x.path)))
                    throw new InvalidOperationException("Unbound candidate clip "+s.Model+"/"+name);
                var settings=AnimationUtility.GetAnimationClipSettings(clip);settings.loopTime=name=="Idle"||name=="Walk"||name=="Run";AnimationUtility.SetAnimationClipSettings(clip,settings);
                string file=Root+"/Clips/"+s.Model+"-"+name+".anim";var old=AssetDatabase.LoadAssetAtPath<AnimationClip>(file);
                if(old){EditorUtility.CopySerialized(clip,old);UnityEngine.Object.DestroyImmediate(clip);clip=old;}
                else AssetDatabase.CreateAsset(clip,file);
                clips.Add(name,clip);
            }
            c.AddParameter("Speed",AnimatorControllerParameterType.Float);var sm=c.layers[0].stateMachine;var locomotion=sm.AddState("Locomotion");sm.defaultState=locomotion;
            var blend=new BlendTree{name="Private authored locomotion",blendType=BlendTreeType.Simple1D,blendParameter="Speed",useAutomaticThresholds=false};
            AssetDatabase.AddObjectToAsset(blend,c);blend.AddChild(clips["Idle"],0);blend.AddChild(clips["Walk"],2.5f);blend.AddChild(clips["Run"],5.5f);locomotion.motion=blend;
            foreach(var pair in clips.Where(x=>x.Key!="Idle"&&x.Key!="Walk"&&x.Key!="Run")){
                c.AddParameter(pair.Key,AnimatorControllerParameterType.Trigger);var state=sm.AddState(pair.Key);state.motion=pair.Value;
                var enter=sm.AddAnyStateTransition(state);enter.hasExitTime=false;enter.hasFixedDuration=true;enter.duration=.075f;enter.canTransitionToSelf=false;enter.AddCondition(AnimatorConditionMode.If,0,pair.Key);
                if(pair.Key!="Death"){var exit=state.AddTransition(locomotion);exit.hasExitTime=true;exit.exitTime=1;exit.hasFixedDuration=true;exit.duration=.12f;}
            }
            EditorUtility.SetDirty(c);return c;
        }
        static GameObject Prefab(Spec s){
            var model=AssetDatabase.LoadAssetAtPath<GameObject>(Model(s,0));Skin(model,Budgets[0]);
            var actor=(GameObject)PrefabUtility.InstantiatePrefab(model);
            if(!actor)throw new InvalidOperationException("Private model instantiation failed.");
            var wrapper=new GameObject(s.Model+" PRIVATE CANDIDATE");
            try{
                if(PrefabUtility.IsPartOfPrefabInstance(actor))PrefabUtility.UnpackPrefabInstance(actor,PrefabUnpackMode.Completely,InteractionMode.AutomatedAction);
                actor.transform.SetParent(wrapper.transform,false);
                foreach(var a in actor.GetComponentsInChildren<Animation>(true))UnityEngine.Object.DestroyImmediate(a);
                foreach(var a in actor.GetComponentsInChildren<Animator>(true))if(a.gameObject!=actor)UnityEngine.Object.DestroyImmediate(a);
                var animator=actor.GetComponent<Animator>();if(!animator)animator=actor.AddComponent<Animator>();animator.runtimeAnimatorController=Controller(s,actor);animator.applyRootMotion=false;
                var skin=Skin(actor,Budgets[0]);skin.updateWhenOffscreen=false;skin.shadowCastingMode=ShadowCastingMode.On;skin.receiveShadows=true;
                var lods=new List<LOD>{new LOD(.09f,new Renderer[]{skin})};
                for(int i=1;i<Budgets.Length;i++)lods.Add(new LOD(i==1?.043f:0,new[]{AttachLod(actor,skin,AssetDatabase.LoadAssetAtPath<GameObject>(Model(s,i)),Budgets[i])}));
                var group=wrapper.AddComponent<LODGroup>();group.fadeMode=LODFadeMode.None;group.SetLODs(lods.ToArray());
                // Normalize only the visual wrapper, never the simulation/collider/hit radius.
                Bounds bounds=skin.bounds;if(bounds.size.y<=.01f||float.IsNaN(bounds.size.y)||float.IsInfinity(bounds.size.y))throw new InvalidOperationException("Invalid candidate bounds.");
                float scale=1.85f/bounds.size.y;actor.transform.localScale*=scale;
                actor.transform.localPosition-=new Vector3(bounds.center.x,bounds.min.y,bounds.center.z)*scale;group.RecalculateBounds();
                foreach(var col in wrapper.GetComponentsInChildren<Collider>(true))UnityEngine.Object.DestroyImmediate(col);
                var saved=PrefabUtility.SaveAsPrefabAsset(wrapper,Root+"/Prefabs/"+s.Model+".prefab");
                if(!saved)throw new InvalidOperationException("Candidate prefab save failed.");
                return saved;
            }finally{UnityEngine.Object.DestroyImmediate(wrapper);}
        }
        [MenuItem("BUKLOD Empire/Play actual owner motion candidates (private)")]
        public static void Prepare(){
            if(Application.isPlaying||EditorApplication.isCompiling||EditorSceneManager.GetActiveScene().isDirty)throw new InvalidOperationException("Stop playback and save the active scene.");
            VerifyInputs();
            if(!AssetDatabase.LoadAssetAtPath<SceneAsset>(OfflineReviewComposer.ScenePath))throw new InvalidOperationException("Assemble existing offline review once before private practice.");
            foreach(var sub in new[]{"Models","Controllers","Clips","Prefabs"})Directory.CreateDirectory(Root+"/"+sub);
            foreach(var s in Specs)for(int i=0;i<Budgets.Length;i++)if(!File.Exists(Model(s,i))||Hash(Model(s,i))!=s.Hashes[i])File.Copy(Source+"/"+FileName(s,i),Model(s,i),true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var prefabs=Specs.ToDictionary(s=>s.Hero,Prefab,StringComparer.Ordinal);
            var original=EditorSceneManager.OpenScene(OfflineReviewComposer.ScenePath,OpenSceneMode.Single);
            if(!EditorSceneManager.SaveScene(original,ScenePath,true))throw new InvalidOperationException("Private scene copy failed.");
            var scene=EditorSceneManager.OpenScene(ScenePath,OpenSceneMode.Single);
            var view=UnityEngine.Object.FindFirstObjectByType<BattleView>();
            if(!view||!view.IsConfiguredReview||!view.visuals)throw new InvalidOperationException("Offline battle view unavailable.");
            var source=view.visuals;var catalog=UnityEngine.Object.Instantiate(source);catalog.name="Private mechanical mapping — no canonical identity approval";
            catalog.heroes=source.heroes.Select(h=>new BattleVisualCatalog.HeroVisual{id=h.id,prefab=prefabs.TryGetValue(h.id,out var p)?p:h.prefab}).ToArray();
            catalog.ValidateOfflineReview();
            string path=Root+"/PrivatePracticeCatalog.asset";var old=AssetDatabase.LoadAssetAtPath<BattleVisualCatalog>(path);
            if(old){EditorUtility.CopySerialized(catalog,old);UnityEngine.Object.DestroyImmediate(catalog);catalog=old;EditorUtility.SetDirty(catalog);}
            else AssetDatabase.CreateAsset(catalog,path);
            view.visuals=catalog;view.ConfigurePrivateCandidatePractice();view.selectedHero="niel";view.premiumVisuals=false;
            // No remote content override, old-rig motion overrides, or mismatched portraits.
            var updater=view.GetComponent<EmpireContentUpdater>();if(updater)UnityEngine.Object.DestroyImmediate(updater);
            var motion=view.GetComponent<ReviewMotionLibrary>();if(motion)UnityEngine.Object.DestroyImmediate(motion);
            var portraits=view.GetComponent<ReviewPortraits>();if(portraits&&portraits.ids!=null)
                for(int i=0;i<portraits.ids.Length;i++)if(prefabs.ContainsKey(portraits.ids[i])){
                    if(portraits.portraits!=null&&i<portraits.portraits.Length)portraits.portraits[i]=null;
                    if(portraits.fullBodies!=null&&i<portraits.fullBodies.Length)portraits.fullBodies[i]=null;
                }
            EditorUtility.SetDirty(view);EditorSceneManager.MarkSceneDirty(scene);
            if(!EditorSceneManager.SaveScene(scene))throw new InvalidOperationException("Private practice save failed.");
            AssetDatabase.SaveAssets();
            var deps=AssetDatabase.GetDependencies(ScenePath,true);
            foreach(var s in Specs)for(int i=0;i<Budgets.Length;i++)if(!deps.Contains(Model(s,i)))throw new InvalidOperationException("Private scene did not bind actual model: "+FileName(s,i));
            Debug.Log("PRIVATE OWNER PRACTICE ASSEMBLED — Niel/Azure, Van/Sentinel, Phan/Hooded temporary mechanical mappings. Select those slots and Start Match. No mastery or bot-learning writes. No APK authorization.");
        }
    }
}
