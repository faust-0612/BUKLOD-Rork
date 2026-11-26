using UnityEngine;
namespace Buklod.Empire {
    // One opt-in review preset. No effect on simulation, targeting, or production presentation.
    public static class StylizedArenaPresentation {
        public const float CameraPitch=55f, CameraDistance=22f, OrthographicSize=8.5f;
        public static Quaternion CameraRotation=>Quaternion.Euler(CameraPitch,0,0);
        public static Vector3 CameraOffset=>CameraRotation*Vector3.back*CameraDistance;
        public static float FollowWeight(float dt)=>1-Mathf.Exp(-9f*Mathf.Max(0,dt));
        public static float Speed(Vector3 before,Vector3 after,float dt){
            if(dt<=0||float.IsNaN(dt)||float.IsInfinity(dt))return 0;
            var delta=after-before;delta.y=0;
            float speed=delta.magnitude/dt;
            return float.IsNaN(speed)||float.IsInfinity(speed)?0:Mathf.Clamp(speed,0,12);
        }
    }
}
