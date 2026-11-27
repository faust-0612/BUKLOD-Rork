using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Authored motion candidates only. The original 13 rigs, identities, Sacred
    // Stones and signature skill clips are never replaced by a generic mesh.
    internal static class OfflineAuthoredMotionReview {
        const string Source="Tools/ReviewOutput/authored-expansion/animation/Unreal-Godot/UAL2_Standard.glb";
        const string Root=CandidateReviewComposer.Out+"/AuthoredMotionReview";
        const string Model=Root+"/UAL2_Standard.glb";
        const string WalkSource="Tools/ReviewOutput/authored-expansion/locomotion/animations/UAL1_Standard.glb";
        const string WalkModel=Root+"/UAL1_Standard.glb";
        const string Receipt="Tools/ReviewOutput/authored-motion-review.json";
        // Canonical names of original skeleton vs the UE mannequin family.
        static readonly string[][] Map={
            new[]{"Pelvis","pelvis"},new[]{"Chest","spine_05","spine_04","spine_03"},
            new[]{"Neck","neck_01","neck"},new[]{"Head","head"},
            new[]{"UpperArm_L","upperarm_l"},new[]{"Forearm_L","lowerarm_l"},new[]{"Hand_L","hand_l"},
            new[]{"UpperArm_R","upperarm_r"},new[]{"Forearm_R","lowerarm_r"},new[]{"Hand_R","hand_r"},
            new[]{"Thigh_L","thigh_l"},new[]{"Shin_L","calf_l"},new[]{"Foot_L","foot_l"},
            new[]{"Thigh_R","thigh_r"},new[]{"Shin_R","calf_r"},new[]{"Foot_R","foot_r"}
        };
        [Serializable] sealed class Row {public string hero,slot,sourceClip,asset,sourceSha256;public float duration;public int mappedBones,samples;}
        [Serializable] sealed class Report {public string status,sourceSha256,walkSourceSha256;public bool runtimeIntegrated,visualApproved;public Row[] rows;}
        sealed class Pose {
            readonly Transform[] t;readonly Vector3[] p,s;readonly Quaternion[] q;
            public Pose(GameObject root){t=root.GetComponentsInChildren<Transform>(true);p=t.Select(x=>x.localPosition).ToArray();s=t.Select(x=>x.localScale).ToArray();q=t.Select(x=>x.localRotation).ToArray();}
            public void Reset(){for(int i=0;i<t.Length;i++){t[i].localPosition=p[i];t[i].localRotation=q[i];t[i].localScale=s[i];}}
        }
        static Transform FindBone(GameObject root,IEnumerable<string> aliases){
            var all=root.GetComponentsInChildren<Transform>(true);
            foreach(var alias in aliases){
                var matches=all.Where(t=>string.Equals(t.name,alias,StringComparison.OrdinalIgnoreCase)).ToArray();
                if(matches.Length>1)throw new BuildFailedException("Ambiguous authored rig bone "+alias);
                if(matches.Length==1)return matches[0];
            }
            throw new BuildFailedException("Missing authored rig bone "+string.Join("/",aliases));
        }
        static Transform[] Bones(GameObject root,bool source)=>Map.Select(m=>FindBone(root,source?m.Skip(1):m.Take(1))).ToArray();
        static Quaternion Basis(Transform[] b){
            var right=(b[7].position-b[4].position).normalized;var up=(b[3].position-b[0].position).normalized;
            var forward=Vector3.Cross(right,up).normalized;
            if(forward.sqrMagnitude<.9f)throw new BuildFailedException("Invalid rig body basis.");
            return Quaternion.LookRotation(forward,Vector3.Cross(forward,right));
        }
        static string Key(string name){
            var last=name.Split('|').Last();
            return new string(last.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());
        }
        static AnimationClip Choose(AnimationClip[] clips,string slot,string[] names){
            foreach(var n in names){
                var matches=clips.Where(c=>Key(c.name)==n).ToArray();
                if(matches.Length>1)throw new BuildFailedException("Ambiguous source motion "+slot);
                if(matches.Length==1)return matches[0];
            }
            throw new BuildFailedException("No supported "+slot+" motion in pinned UAL2; available: "+string.Join(", ",clips.Select(c=>c.name)));
        }
        static bool Finite(Quaternion q)=>!float.IsNaN(q.x)&&!float.IsInfinity(q.x)&&!float.IsNaN(q.y)&&!float.IsInfinity(q.y)&&!float.IsNaN(q.z)&&!float.IsInfinity(q.z)&&!float.IsNaN(q.w)&&!float.IsInfinity(q.w);
        static int Child(int i){
            // Segment directions compensate for differing A/T rest poses.
            switch(i){case 4:return 5;case 5:return 6;case 7:return 8;case 8:return 9;case 10:return 11;case 11:return 12;case 13:return 14;case 14:return 15;default:return -1;}
        }
        static string Hash(string path){using(var f=File.OpenRead(path))using(var h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(f)).Replace("-","").ToLowerInvariant();}
        internal static void Prepare(BattleVisualCatalog catalog,GameObject battleRoot){
            if(File.Exists(Receipt))File.Delete(Receipt);
            if(!File.Exists(Source)||!File.Exists(WalkSource))throw new BuildFailedException("Missing verified animation caches; run authored acquisition.");
            Directory.CreateDirectory(Root);
            if(!File.Exists(Model)||Hash(Model)!=Hash(Source))File.Copy(Source,Model,true);
            if(!File.Exists(WalkModel)||Hash(WalkModel)!=Hash(WalkSource))File.Copy(WalkSource,WalkModel,true);
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var sourceModel=AssetDatabase.LoadAssetAtPath<GameObject>(Model);
            var walkModel=AssetDatabase.LoadAssetAtPath<GameObject>(WalkModel);
            if(!sourceModel||!walkModel)throw new BuildFailedException("UAL1/UAL2 authored model import failed.");
            var clips=AssetDatabase.LoadAllAssetsAtPath(Model).OfType<AnimationClip>().Where(c=>c.length>0).ToArray();
            var walks=AssetDatabase.LoadAllAssetsAtPath(WalkModel).OfType<AnimationClip>().Where(c=>c.length>0).ToArray();
            var walk=Choose(walks,"walk",new[]{"walkloop","walkfwdloop","walkforwardloop"});
            var attack=Choose(clips,"attack",new[]{"meleehook","swordregulara","meleeuppercut"});
            var source=UnityEngine.Object.Instantiate(sourceModel);var locomotion=UnityEngine.Object.Instantiate(walkModel);
            string sourceHash=Hash(Source),walkHash=Hash(WalkSource);
            var rows=new List<Row>();
            try{
                foreach(var h in catalog.heroes){
                    var target=UnityEngine.Object.Instantiate(h.prefab);
                    try{
                        var animator=target.GetComponentInChildren<Animator>(true);
                        if(!animator)throw new BuildFailedException("Missing target animator "+h.id);
                        var targetRoot=animator.gameObject;var tb=Bones(targetRoot,false);
                        var targetPose=new Pose(targetRoot);var targetRest=tb.Select(t=>t.rotation).ToArray();
                        foreach(var pair in new[]{(slot:"Walk",clip:walk,rig:locomotion,hash:walkHash),(slot:"Attack",clip:attack,rig:source,hash:sourceHash)}){
                            var sb=Bones(pair.rig,true);var sourcePose=new Pose(pair.rig);
                            var sourceRest=sb.Select(t=>t.rotation).ToArray();
                            var change=Basis(tb)*Quaternion.Inverse(Basis(sb));
                            int frames=Mathf.CeilToInt(pair.clip.length*30)+1;
                            if(frames<2||frames>901)throw new BuildFailedException("Unsupported authored motion length.");
                            var curves=new AnimationCurve[tb.Length,4];
                            for(int i=0;i<tb.Length;i++)for(int axis=0;axis<4;axis++)curves[i,axis]=new AnimationCurve();
                            var previous=new Quaternion[tb.Length];var first=new Quaternion[tb.Length];float motion=0;
                            for(int frame=0;frame<frames;frame++){
                                float time=pair.clip.length*frame/(frames-1);
                                sourcePose.Reset();targetPose.Reset();
                                pair.clip.SampleAnimation(pair.rig,time);
                                for(int i=0;i<tb.Length;i++){
                                    var delta=sb[i].rotation*Quaternion.Inverse(sourceRest[i]);
                                    tb[i].rotation=change*delta*Quaternion.Inverse(change)*targetRest[i];
                                    int child=Child(i);
                                    if(child>=0){
                                        var targetDirection=tb[child].position-tb[i].position;
                                        var sourceDirection=change*(sb[child].position-sb[i].position);
                                        if(targetDirection.sqrMagnitude<.000001f||sourceDirection.sqrMagnitude<.000001f)throw new BuildFailedException("Degenerate retarget segment "+h.id);
                                        tb[i].rotation=Quaternion.FromToRotation(targetDirection,sourceDirection)*tb[i].rotation;
                                    }
                                    var q=tb[i].localRotation;
                                    if(!Finite(q))throw new BuildFailedException("Nonfinite authored motion "+h.id);
                                    if(frame==0)first[i]=q;else{
                                        motion=Mathf.Max(motion,Quaternion.Angle(first[i],q));
                                        if(Quaternion.Dot(previous[i],q)<0)q=new Quaternion(-q.x,-q.y,-q.z,-q.w);
                                    }
                                    previous[i]=q;
                                    curves[i,0].AddKey(time,q.x);curves[i,1].AddKey(time,q.y);curves[i,2].AddKey(time,q.z);curves[i,3].AddKey(time,q.w);
                                }
                            }
                            if(motion<2)throw new BuildFailedException("Authored retarget is static: "+h.id+"/"+pair.slot);
                            var baked=new AnimationClip{name="Authored"+pair.slot,frameRate=30,legacy=false};
                            for(int i=0;i<tb.Length;i++){
                                string path=AnimationUtility.CalculateTransformPath(tb[i],targetRoot.transform);
                                for(int axis=0;axis<4;axis++)
                                    AnimationUtility.SetEditorCurve(baked,EditorCurveBinding.FloatCurve(path,typeof(Transform),"m_LocalRotation."+"xyzw"[axis]),curves[i,axis]);
                            }
                            baked.EnsureQuaternionContinuity();
                            var settings=AnimationUtility.GetAnimationClipSettings(baked);settings.loopTime=pair.slot=="Walk";AnimationUtility.SetAnimationClipSettings(baked,settings);
                            string asset=Root+"/"+h.id+"_"+pair.slot+".anim";
                            var old=AssetDatabase.LoadAssetAtPath<AnimationClip>(asset);
                            if(old){EditorUtility.CopySerialized(baked,old);UnityEngine.Object.DestroyImmediate(baked);baked=old;}
                            else AssetDatabase.CreateAsset(baked,asset);
                            // Re-sample the baked clip on the actual target, not the source mannequin.
                            targetPose.Reset();baked.SampleAnimation(targetRoot,baked.length*.5f);
                            foreach(var b in tb)if(!Finite(b.localRotation))throw new BuildFailedException("Invalid baked curve "+h.id);
                            // Deform the real original high-detail skins, not the mannequin.
                            var mesh=new Mesh();
                            try{
                                var skins=targetRoot.GetComponentsInChildren<SkinnedMeshRenderer>(true).Where(x=>x.sharedMesh&&x.name!="Mobile LOD1").ToArray();
                                if(skins.Length==0)throw new BuildFailedException("No target skin "+h.id);
                                foreach(float at in new[]{0f,.25f,.5f,.75f,.99f}){
                                    targetPose.Reset();baked.SampleAnimation(targetRoot,baked.length*at);
                                    foreach(var skin in skins){
                                        mesh.Clear();skin.BakeMesh(mesh);mesh.RecalculateBounds();
                                        var bounds=mesh.bounds;
                                        if(mesh.vertexCount!=skin.sharedMesh.vertexCount||mesh.vertexCount==0||
                                           float.IsNaN(bounds.size.sqrMagnitude)||float.IsInfinity(bounds.size.sqrMagnitude)||bounds.size.sqrMagnitude<=.000001f||
                                           bounds.size.magnitude>Mathf.Max(.1f,skin.sharedMesh.bounds.size.magnitude)*3f)
                                            throw new BuildFailedException("Invalid authored deformation "+h.id+"/"+pair.slot);
                                    }
                                }
                            }finally{UnityEngine.Object.DestroyImmediate(mesh);}
                            sourcePose.Reset();
                            rows.Add(new Row{hero=h.id,slot=pair.slot,sourceClip=pair.clip.name,sourceSha256=pair.hash,asset=asset,duration=baked.length,mappedBones=tb.Length,samples=frames});
                        }
                    }finally{UnityEngine.Object.DestroyImmediate(target);}
                }
            }finally{UnityEngine.Object.DestroyImmediate(source);UnityEngine.Object.DestroyImmediate(locomotion);}
            if(rows.Count!=26)throw new BuildFailedException("Incomplete authored motion candidates.");
            var library=battleRoot.AddComponent<ReviewMotionLibrary>();
            library.entries=catalog.heroes.Select(h=>{
                var row=rows.Single(r=>r.hero==h.id&&r.slot=="Walk");
                var clip=AssetDatabase.LoadAssetAtPath<AnimationClip>(row.asset);
                if(!clip)throw new BuildFailedException("Missing baked walk "+h.id);
                return new ReviewMotionLibrary.Entry{prefab=h.prefab,walk=clip};
            }).ToArray();
            library.Validate();
            AssetDatabase.SaveAssets();
            File.WriteAllText(Receipt,JsonUtility.ToJson(new Report{status="AUTHORED_WALK_PREVIEW_ONLY",sourceSha256=sourceHash,walkSourceSha256=walkHash,runtimeIntegrated=true,visualApproved=false,rows=rows.ToArray()},true));
            Debug.Log("BUKLOD_AUTHORED_MOTION_CANDIDATES: 26 mapped clips; 13 walks available as opt-in gameplay preview. Attacks and signature skills unchanged.");
        }
        internal static void ValidateDependencies(string[] dependencies){
            if(!AuthoredExpansionReview.Requested)return;
            foreach(var h in HeroKitCatalog.All)
                if(!dependencies.Contains(Root+"/"+h.Id+"_Walk.anim"))
                    throw new BuildFailedException("Missing authored walk scene dependency "+h.Id);
            if(dependencies.Contains(Model)||dependencies.Contains(WalkModel))
                throw new BuildFailedException("Source mannequins must not enter the playable APK.");
        }
    }
}
