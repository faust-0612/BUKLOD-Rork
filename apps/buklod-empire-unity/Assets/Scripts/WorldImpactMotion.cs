using UnityEngine;
namespace Buklod.Empire {
    public enum WorldImpactKind { Structure, Core, Unit, Work }
    // Visual trajectories only; no colliders, rewards or game-state mutation.
    public static class WorldImpactMotion {
        public const int Fragments=16;
        public readonly struct Sample {
            public readonly Vector3 Position,Rotation;public readonly float Size;
            public Sample(Vector3 position,Vector3 rotation,float size){Position=position;Rotation=rotation;Size=size;}
        }
        static float Hash(int seed,int index,int channel){
            unchecked {
                uint x=(uint)seed*747796405u+(uint)index*2891336453u+(uint)channel*277803737u;
                x^=x>>16;x*=2246822519u;x^=x>>13;x*=3266489917u;x^=x>>16;
                return (x&65535u)/65535f;
            }
        }
        public static float Duration(WorldImpactKind k)=>k==WorldImpactKind.Core?1.45f:k==WorldImpactKind.Structure?1.1f:k==WorldImpactKind.Work?.55f:.65f;
        public static Sample Evaluate(WorldImpactKind kind,int seed,int index,float progress){
            float t=Mathf.Clamp01(progress),q=Hash(seed,index,1),h=Hash(seed,index,2);
            float a=Hash(seed,index,3)*2*Mathf.PI;
            bool building=kind==WorldImpactKind.Structure||kind==WorldImpactKind.Core;
            float reach=kind==WorldImpactKind.Core?4.1f:building?2.5f:kind==WorldImpactKind.Work?.75f:1.15f;
            float lift=building?1.5f:kind==WorldImpactKind.Work?.65f:.85f;
            float radial=reach*(.25f+.75f*q)*t;
            float y=lift*(.45f+.55f*h)*4*t*(1-t)+.06f;
            float baseSize=building?.19f+.25f*q:.045f+.085f*q;
            float size=baseSize*(1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(.58f,1,t)));
            var rotation=new Vector3(Hash(seed,index,4),Hash(seed,index,5),Hash(seed,index,6))*720*t;
            return new Sample(new Vector3(Mathf.Cos(a)*radial,y,Mathf.Sin(a)*radial),rotation,size);
        }
    }
}
