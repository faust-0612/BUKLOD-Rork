using System;
using System.Linq;
using UnityEditor;
using UnityEngine;
namespace Buklod.Empire.Editor {
    // Resample real imported action curves; no substitute skeleton, animation or root movement.
    internal static class CombatMotionBaker {
        internal static bool Applies(string slot)=>slot=="Attack"||slot=="Primary"||slot=="Secondary"||slot=="Ultimate"||slot=="Hit";
        internal static void Apply(AnimationClip clip,string hero,string slot){
            if(!Applies(slot))return;
            if(!clip||clip.length<=0||float.IsNaN(clip.length)||float.IsInfinity(clip.length))throw new InvalidOperationException("Invalid action clip");
            var shape=SkillCueShape.Impact;
            if(slot!="Attack"&&slot!="Hit"){
                var skill=(SkillSlot)Enum.Parse(typeof(SkillSlot),slot);
                if(!SkillCueCatalog.TryGet(HeroKitCatalog.Get(hero).Skill(skill).Id,out var cue))throw new InvalidOperationException("Missing canonical skill cue: "+hero+"/"+slot);
                shape=cue.Shape;
            }
            float length=clip.length;
            float release=CombatMotionRhythm.Release(slot,shape);
            int frames=Mathf.Clamp(Mathf.CeilToInt(length*60),12,480);
            // Preserve existing animation events and object references; refuse unsupported ones
            // rather than silently moving or deleting them.
            if(AnimationUtility.GetObjectReferenceCurveBindings(clip).Length!=0||AnimationUtility.GetAnimationEvents(clip).Length!=0)
                throw new InvalidOperationException("Action has discrete events requiring manual timing review: "+hero+"/"+slot);
            var bindings=AnimationUtility.GetCurveBindings(clip);
            foreach(var binding in bindings){
                var source=AnimationUtility.GetEditorCurve(clip,binding);if(source==null||source.length==0)continue;
                var keys=new Keyframe[frames+1];
                for(int i=0;i<=frames;i++){
                    float t=i/(float)frames;float phase=CombatMotionRhythm.SourcePhase(t,release);
                    float value=source.Evaluate(phase*length);
                    if(float.IsNaN(value)||float.IsInfinity(value))throw new InvalidOperationException("Nonfinite animation curve");
                    keys[i]=new Keyframe(t*length,value);
                }
                var retimed=new AnimationCurve(keys);
                for(int i=0;i<keys.Length;i++){
                    AnimationUtility.SetKeyLeftTangentMode(retimed,i,AnimationUtility.TangentMode.Linear);
                    AnimationUtility.SetKeyRightTangentMode(retimed,i,AnimationUtility.TangentMode.Linear);
                }
                AnimationUtility.SetEditorCurve(clip,binding,retimed);
            }
            clip.frameRate=60;clip.EnsureQuaternionContinuity();
            if(Mathf.Abs(clip.length-length)>.018f)throw new InvalidOperationException("Action duration drift: "+hero+"/"+slot);
        }
    }
}
