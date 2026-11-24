using UnityEngine;
namespace Buklod.Empire {
    // Visual crop canopy only. No effect on harvest rate, resource stock or building footprint.
    public sealed class ReviewFarmGrowth:MonoBehaviour {
        [SerializeField] Transform canopy;
        [SerializeField] Vector3 fullScale=Vector3.one;
        public void Configure(Transform crop){
            if(!crop||!crop.IsChildOf(transform))throw new System.ArgumentException("Missing farm crop canopy.");
            canopy=crop;fullScale=crop.localScale;
        }
        public static float Fraction(double stock,double capacity){
            if(double.IsNaN(stock)||double.IsInfinity(stock)||double.IsNaN(capacity)||double.IsInfinity(capacity)||capacity<=0)return 0;
            return Mathf.Clamp01((float)(stock/capacity));
        }
        public static float Height(double stock,double capacity)=>Mathf.Lerp(.10f,1f,Fraction(stock,capacity));
        public void Apply(double stock,double capacity,bool immediate,float dt){
            if(!canopy)return;
            var scale=canopy.localScale;
            float target=fullScale.y*Height(stock,capacity);
            scale.y=immediate?target:Mathf.MoveTowards(scale.y,target,Mathf.Abs(fullScale.y)*Mathf.Max(0,dt)*1.8f);
            canopy.localScale=scale;
        }
    }
}
