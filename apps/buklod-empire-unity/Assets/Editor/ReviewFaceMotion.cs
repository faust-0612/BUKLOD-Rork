using System;
using System.Linq;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Animate original eye aperture geometry through independent skinned joints.
    // Bounded closure, no jaw, lip sync or full expression morphs.
    internal static class ReviewFaceMotion {
        internal static void Bake(GameObject root,AnimationClip clip,string state,string hero){
            var all=root.GetComponentsInChildren<Transform>(true);
            var eyes=new[]{all.Single(t=>t.name=="ReviewEye_L"),all.Single(t=>t.name=="ReviewEye_R")};
            float duration=clip.length;if(duration<=0)throw new InvalidOperationException("Empty facial motion clip");
            foreach(var eye in eyes){
                string path=AnimationUtility.CalculateTransformPath(eye,root.transform);
                var curve=new AnimationCurve(new Keyframe(0,1),new Keyframe(duration,1));
                if(state=="Idle"){
                    float center=duration*ReviewPortraitMotion.BlinkPhase(hero);
                    float half=Mathf.Min(.085f,duration*.12f);
                    curve=new AnimationCurve(new Keyframe(0,1),new Keyframe(center-half,1),new Keyframe(center,.08f),new Keyframe(center+half,1),new Keyframe(duration,1));
                    for(int i=0;i<curve.length;i++){AnimationUtility.SetKeyLeftTangentMode(curve,i,AnimationUtility.TangentMode.ClampedAuto);AnimationUtility.SetKeyRightTangentMode(curve,i,AnimationUtility.TangentMode.ClampedAuto);}
                }
                AnimationUtility.SetEditorCurve(clip,EditorCurveBinding.FloatCurve(path,typeof(Transform),"m_LocalScale.y"),curve);
            }
        }
    }
}
