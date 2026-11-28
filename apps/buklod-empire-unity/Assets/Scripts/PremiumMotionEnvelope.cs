using UnityEngine;
namespace Buklod.Empire {
    internal static class PremiumMotionEnvelope {
        // Quintic easing keeps both velocity and acceleration continuous at endpoints.
        internal static float Ease(float value){float t=Mathf.Clamp01(value);return t*t*t*(t*(t*6-15)+10);}
        internal static float BlendDuration(string name){
            switch(name){case "Death":return .065f;case "Attack":case "Hit":return .075f;case "Primary":case "Secondary":case "Ultimate":return .105f;default:return .18f;}
        }
        internal static float Reveal(float t){return Ease(t/.12f)*(1-Ease((t-.52f)/.48f));}
    }
}
