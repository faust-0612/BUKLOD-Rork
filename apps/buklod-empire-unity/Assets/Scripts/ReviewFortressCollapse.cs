using UnityEngine;
namespace Buklod.Empire {
    // Actual imported structure root is animated; surrounding fragments are a
    // separate existing effect. No physics, collider or gameplay destruction.
    public static class ReviewFortressCollapse {
        public readonly struct Pose {public readonly Vector3 Offset,Tilt,Scale;public Pose(Vector3 offset,Vector3 tilt,Vector3 scale){Offset=offset;Tilt=tilt;Scale=scale;}}
        public static Pose Evaluate(float progress,float height,int id,bool core){
            float t=Mathf.Clamp01(progress);height=Mathf.Clamp(height,.5f,25f);
            float settle=Mathf.SmoothStep(0,1,Mathf.InverseLerp(.12f,1,t));
            float buckle=Mathf.Sin(Mathf.PI*Mathf.Clamp01(t/.44f))*(1-settle);
            float direction=(id&1)==0?1:-1;
            float tilt=(core?9:14)*direction;
            float shrink=Mathf.Lerp(1,.045f,settle);
            return new Pose(new Vector3(0,-height*.36f*settle,0),new Vector3(tilt*(buckle*.35f+settle),0,-tilt*.6f*settle),new Vector3(Mathf.Lerp(1,.78f,settle),shrink,Mathf.Lerp(1,.78f,settle)));
        }
    }
}
