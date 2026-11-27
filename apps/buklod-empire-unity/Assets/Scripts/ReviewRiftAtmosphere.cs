using UnityEngine;
namespace Buklod.Empire {
    // Local presentation only; public terrain coordinate, not enemy state.
    // Reuses the existing ambience loop, no fabricated separate recording.
    public static class ReviewRiftAtmosphere {
        public readonly struct Zone {public readonly float Gain,Cutoff;public Zone(float gain,float cutoff){Gain=gain;Cutoff=cutoff;}}
        public static Zone At(float x,float width){
            if(width<=0||float.IsNaN(x)||float.IsInfinity(x)||float.IsNaN(width)||float.IsInfinity(width))return new Zone(1,16000);
            float p=Mathf.Clamp01(x/width);
            if(p<.5f){float t=Mathf.SmoothStep(0,1,p*2);return new Zone(Mathf.Lerp(.86f,1.18f,t),Mathf.Lerp(12500,17000,t));}
            else{float t=Mathf.SmoothStep(0,1,(p-.5f)*2);return new Zone(Mathf.Lerp(1.18f,.91f,t),Mathf.Lerp(17000,7200,t));}
        }
    }
}
