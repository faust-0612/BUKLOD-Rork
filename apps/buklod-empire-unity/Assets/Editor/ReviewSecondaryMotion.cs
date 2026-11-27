using System;
using System.Linq;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Bake secondary cape follow-through into existing locomotion clips only.
    // No changes to bone names, root motion, signature skill timing or attacks.
    internal static class ReviewSecondaryMotion {
        internal static void Bake(GameObject root,AnimationClip clip,string state){
            var mantle=root.GetComponentsInChildren<Transform>(true).Single(t=>t.name=="Mantle");
            string path=AnimationUtility.CalculateTransformPath(mantle,root.transform);
            var all=root.GetComponentsInChildren<Transform>(true);
            var positions=all.Select(t=>t.localPosition).ToArray();var rotations=all.Select(t=>t.localRotation).ToArray();var scales=all.Select(t=>t.localScale).ToArray();
            var curves=new[]{new AnimationCurve(),new AnimationCurve(),new AnimationCurve(),new AnimationCurve()};
            Quaternion previous=Quaternion.identity;
            float duration=clip.length;if(duration<=0)throw new InvalidOperationException("Empty locomotion clip.");
            float amplitude=state=="Run"?12f:state=="Walk"?7f:2.5f;
            try{
                for(int i=0;i<=32;i++){
                    float phase=i/32f;clip.SampleAnimation(root,duration*phase);
                    float wave=2*Mathf.PI*phase;
                    var q=mantle.localRotation*Quaternion.Euler(amplitude*Mathf.Sin(wave-.6f),amplitude*.32f*Mathf.Sin(wave),amplitude*.45f*Mathf.Sin(wave-1.1f));
                    if(i>0&&Quaternion.Dot(previous,q)<0)q=new Quaternion(-q.x,-q.y,-q.z,-q.w);previous=q;
                    for(int k=0;k<4;k++)curves[k].AddKey(duration*phase,q[k]);
                }
                foreach(var binding in AnimationUtility.GetCurveBindings(clip).Where(b=>b.path==path&&b.type==typeof(Transform)&&b.propertyName.IndexOf("Euler",StringComparison.OrdinalIgnoreCase)>=0))
                    AnimationUtility.SetEditorCurve(clip,binding,null);
                for(int k=0;k<4;k++)AnimationUtility.SetEditorCurve(clip,EditorCurveBinding.FloatCurve(path,typeof(Transform),"m_LocalRotation."+"xyzw"[k]),curves[k]);
                clip.EnsureQuaternionContinuity();
            }finally{for(int i=0;i<all.Length;i++){all[i].localPosition=positions[i];all[i].localRotation=rotations[i];all[i].localScale=scales[i];}}
        }
    }
}
