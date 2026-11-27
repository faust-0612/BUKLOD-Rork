using System;
using System.Linq;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
namespace Buklod.Empire.Editor {
    internal static class ReviewWeaponMotion {
        static Transform Bone(GameObject root,string name){
            var rows=root.GetComponentsInChildren<Transform>(true).Where(t=>t.name==name).ToArray();
            if(rows.Length!=1)throw new BuildFailedException("Weapon motion rig mismatch: "+name);
            return rows[0];
        }
        // Preserve all imported non-rotation bindings and original skill assets.
        // Resample the original attack and introduce equipment-specific accents.
        internal static AnimationClip Bake(GameObject root,string id,AnimationClip original){
            var profile=ReviewWeaponProfiles.Get(id);var kit=HeroKitCatalog.Get(id);
            float duration=ReviewWeaponProfiles.Duration(original.length,kit.BasicCooldown);
            var all=root.GetComponentsInChildren<Transform>(true);
            var positions=all.Select(t=>t.localPosition).ToArray();
            var rotations=all.Select(t=>t.localRotation).ToArray();
            var scales=all.Select(t=>t.localScale).ToArray();
            var names=new[]{"Chest","UpperArm_R","Forearm_R","UpperArm_L","Thigh_L","Thigh_R","Shin_L","Shin_R"};
            var bones=names.Select(n=>Bone(root,n)).ToArray();
            var curves=new AnimationCurve[bones.Length,4];
            for(int j=0;j<bones.Length;j++)for(int k=0;k<4;k++)curves[j,k]=new AnimationCurve();
            var previous=new Quaternion[bones.Length];
            var clip=UnityEngine.Object.Instantiate(original);
            clip.name="Attack";clip.legacy=false;clip.frameRate=30;
            try{
                // Scale existing curves to the same duration (including unmodified channels).
                foreach(var binding in AnimationUtility.GetCurveBindings(clip)){
                    var c=AnimationUtility.GetEditorCurve(clip,binding);
                    if(c==null)continue;
                    float ratio=duration/original.length;
                    var keys=c.keys;
                    for(int i=0;i<keys.Length;i++){
                        keys[i].time*=ratio;keys[i].inTangent/=ratio;keys[i].outTangent/=ratio;
                    }
                    c.keys=keys;AnimationUtility.SetEditorCurve(clip,binding,c);
                }
                for(int frame=0;frame<=24;frame++){
                    float t=frame/24f,time=t*duration;
                    for(int i=0;i<all.Length;i++){all[i].localPosition=positions[i];all[i].localRotation=rotations[i];all[i].localScale=scales[i];}
                    original.SampleAnimation(root,t*original.length);
                    float pulse=Mathf.Sin(Mathf.PI*t);
                    float strike=pulse*Mathf.Sin(2*Mathf.PI*(t-.18f));
                    var offsets=new[]{
                        new Vector3(profile.ChestPitch*pulse,profile.ChestYaw*strike,0),
                        new Vector3(profile.RightPitch*pulse,profile.RightYaw*strike,profile.RightRoll*pulse),
                        new Vector3(profile.Forearm*pulse,0,0),
                        new Vector3(profile.LeftPitch*pulse,0,profile.LeftRoll*pulse),
                        new Vector3(-profile.Stance*pulse,0,0),
                        new Vector3(profile.Stance*.5f*pulse,0,0),
                        new Vector3(profile.Stance*pulse,0,0),
                        new Vector3(profile.Stance*.55f*pulse,0,0)
                    };
                    for(int j=0;j<bones.Length;j++){
                        var q=bones[j].localRotation*Quaternion.Euler(offsets[j]);
                        if(frame>0&&Quaternion.Dot(previous[j],q)<0)q=new Quaternion(-q.x,-q.y,-q.z,-q.w);
                        previous[j]=q;
                        for(int k=0;k<4;k++)curves[j,k].AddKey(time,q[k]);
                    }
                }
                for(int j=0;j<bones.Length;j++){
                    string path=AnimationUtility.CalculateTransformPath(bones[j],root.transform);
                    // Remove alternate Euler bindings for these bones, avoiding competing rotation curves.
                    foreach(var binding in AnimationUtility.GetCurveBindings(clip).Where(b=>b.path==path&&b.type==typeof(Transform)&&b.propertyName.IndexOf("Euler",StringComparison.OrdinalIgnoreCase)>=0))
                        AnimationUtility.SetEditorCurve(clip,binding,null);
                    for(int k=0;k<4;k++)AnimationUtility.SetEditorCurve(clip,EditorCurveBinding.FloatCurve(path,typeof(Transform),"m_LocalRotation."+"xyzw"[k]),curves[j,k]);
                }
                clip.EnsureQuaternionContinuity();
                if(clip.length>kit.BasicCooldown+.001f)throw new BuildFailedException("Weapon motion exceeds existing attack cadence: "+id);
                return clip;
            }catch{UnityEngine.Object.DestroyImmediate(clip);throw;}
            finally{for(int i=0;i<all.Length;i++){all[i].localPosition=positions[i];all[i].localRotation=rotations[i];all[i].localScale=scales[i];}}
        }
    }
}
