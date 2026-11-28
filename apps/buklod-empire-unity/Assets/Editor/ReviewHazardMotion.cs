using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Buklod.Empire.Editor {
    // Original key poses for the two pinned CC0 rigs, relative to their imported rest poses.
    internal static class ReviewHazardMotion {
        internal static AnimationClip Create(GameObject rig,bool demon,string action){
            var clip=new AnimationClip{name=action,frameRate=30};
            float[] time;
            var tracks=new Dictionary<string,Vector3[]>(StringComparer.Ordinal);
            void Pose(string bone,params Vector3[] keys)=>tracks.Add(bone,keys);
            Vector3 R(float pitch=0,float yaw=0,float roll=0)=>new Vector3(pitch,yaw,roll);
            if(demon&&action=="Move"){
                time=new[]{0f,.18f,.36f,.54f,.72f};
                Pose("Torso",R(12),R(17,0,-6),R(12),R(17,0,6),R(12));
                Pose("Wing1.L",R(0,0,18),R(0,0,-34),R(0,0,12),R(0,0,-24),R(0,0,18));
                Pose("Wing1.R",R(0,0,-18),R(0,0,24),R(0,0,-12),R(0,0,34),R(0,0,-18));
            }else if(demon&&action=="Attack"){
                time=new[]{0f,.06f,.15f,.30f,.54f};
                Pose("Torso",R(-14),R(26),R(18),R(-7),R());
                Pose("Neck",R(-8),R(17),R(10),R(-5),R());
                Pose("UpperArm.L",R(-42,0,17),R(46,0,-14),R(31,0,-9),R(-10),R());
                Pose("UpperArm.R",R(-42,0,-17),R(46,0,14),R(31,0,9),R(-10),R());
                Pose("Wing1.L",R(0,0,25),R(0,0,-34),R(0,0,-17),R(0,0,10),R());
                Pose("Wing1.R",R(0,0,-25),R(0,0,34),R(0,0,17),R(0,0,-10),R());
            }else if(action=="Hit"){
                time=new[]{0f,.075f,.17f,.32f};
                if(demon){
                    Pose("Torso",R(),R(-24,8,-14),R(8,-3,5),R());
                    Pose("Wing1.L",R(),R(0,0,24),R(0,0,-10),R());
                    Pose("Wing1.R",R(),R(0,0,-18),R(0,0,9),R());
                }else{
                    Pose("Chest",R(),R(-21,13),R(8,-5),R());
                    Pose("Neck",R(),R(-27,19),R(12,-8),R());
                    Pose("Head",R(),R(-15,9),R(6,-4),R());
                    Pose("Tail1",R(),R(0,-9),R(0,13),R());
                }
            }else if(action=="Death"){
                time=new[]{0f,.18f,.42f,.73f,1.05f};
                if(demon){
                    Pose("Torso",R(),R(-18,0,-10),R(30,0,28),R(66,0,52),R(78,0,65));
                    Pose("Neck",R(),R(-12),R(21),R(33),R(38));
                    Pose("Wing1.L",R(),R(0,0,-22),R(0,0,22),R(0,0,48),R(0,0,54));
                    Pose("Wing1.R",R(),R(0,0,22),R(0,0,-22),R(0,0,-38),R(0,0,-48));
                }else{
                    Pose("Body",R(),R(-9,7),R(9,0,22),R(16,0,57),R(18,0,61));
                    Pose("Chest",R(),R(-13),R(19),R(32),R(36));
                    Pose("Neck",R(),R(-18),R(21),R(36),R(40));
                    Pose("Head",R(),R(-9),R(12),R(26),R(29));
                    Pose("Tail1",R(),R(0,-18),R(0,19),R(0,7),R(0,5));
                    Pose("Tail2",R(),R(0,9),R(0,-13),R(0,-4),R(0,-2));
                }
            }else throw new ArgumentException("Unsupported original hazard motion: "+action);

            var bones=new HashSet<Transform>(rig.GetComponentsInChildren<SkinnedMeshRenderer>(true)
                .SelectMany(renderer=>renderer.bones).Where(bone=>bone));
            foreach(var track in tracks){
                var matches=bones.Where(bone=>bone.name==track.Key&&bone.IsChildOf(rig.transform)).ToArray();
                if(matches.Length!=1)throw new InvalidOperationException("Missing or ambiguous hazard bone: "+track.Key);
                var bone=matches[0];
                string path=AnimationUtility.CalculateTransformPath(bone,rig.transform);
                var poses=track.Value.Select(offset=>bone.localRotation*Quaternion.Euler(offset)).ToArray();
                for(int i=1;i<poses.Length;i++)if(Quaternion.Dot(poses[i-1],poses[i])<0){
                    var q=poses[i];poses[i]=new Quaternion(-q.x,-q.y,-q.z,-q.w);
                }
                for(int axis=0;axis<4;axis++){
                    int component=axis;
                    var curve=new AnimationCurve(time.Select((t,i)=>new Keyframe(t,poses[i][component])).ToArray());
                    AnimationUtility.SetEditorCurve(clip,EditorCurveBinding.FloatCurve(path,typeof(Transform),"m_LocalRotation."+"xyzw"[axis]),curve);
                }
            }
            clip.EnsureQuaternionContinuity();
            var settings=AnimationUtility.GetAnimationClipSettings(clip);
            settings.loopTime=action=="Move";
            AnimationUtility.SetAnimationClipSettings(clip,settings);
            return clip;
        }
    }
}
