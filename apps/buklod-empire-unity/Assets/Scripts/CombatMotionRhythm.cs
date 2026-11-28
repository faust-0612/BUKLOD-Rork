using UnityEngine;
namespace Buklod.Empire {
    // Presentation beat mapping only. The simulation's authoritative action timing is untouched.
    internal static class CombatMotionRhythm {
        internal static float Release(string action,SkillCueShape shape){
            if(action=="Attack")return .34f;
            if(action=="Hit")return .20f;
            switch(shape){
                case SkillCueShape.Dash:return .22f;
                case SkillCueShape.Bolt:return .33f;
                case SkillCueShape.Impact:return .36f;
                case SkillCueShape.Wall:return .43f;
                case SkillCueShape.Shield:return .37f;
                case SkillCueShape.Heal:return .46f;
                case SkillCueShape.Summon:return .48f;
                case SkillCueShape.Snare:return .42f;
                default:return .38f;
            }
        }
        internal static float SourcePhase(float t,float release){
            t=Mathf.Clamp01(t);release=Mathf.Clamp(release,.18f,.55f);
            // Smooth monotonic time warp. Preserve start, end, and source pose ordering.
            // Piecewise Hermite (positive shared knot tangent) gives a fast release and
            // longer follow-through without a discontinuous pose velocity.
            float slope=Mathf.Min(.5f/release,.5f/(1-release))*.85f;
            if(t<=release)return Segment(t/release,0,.5f,release*.35f,release*slope);
            return Segment((t-release)/(1-release),.5f,1,(1-release)*slope,(1-release)*.45f);
        }
        static float Segment(float t,float a,float b,float ma,float mb){
            float t2=t*t,t3=t2*t;return Mathf.Clamp01((2*t3-3*t2+1)*a+(t3-2*t2+t)*ma+(-2*t3+3*t2)*b+(t3-t2)*mb);
        }
        internal static float ProtectedSeconds(string action,float clipLength){
            if(clipLength<=0||float.IsNaN(clipLength)||float.IsInfinity(clipLength))return 0;
            float fraction=action=="Ultimate"?.68f:action=="Attack"?.44f:.56f;
            return Mathf.Clamp(clipLength*fraction,.08f,action=="Ultimate"?.48f:.34f);
        }
        internal static bool CanReact(float simulationTime,float protectedUntil)=>simulationTime>=protectedUntil;
    }
}
