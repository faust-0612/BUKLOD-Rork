using UnityEngine;
namespace Buklod.Empire {
    // Same pixel-space geometry for rendering and finger ownership.
    public static class ArenaTouchLayout {
        public static Rect Safe(Rect safe,int width,int height){
            var full=new Rect(0,0,Mathf.Max(1,width),Mathf.Max(1,height));
            float x0=Mathf.Clamp(safe.xMin,0,full.width),y0=Mathf.Clamp(safe.yMin,0,full.height);
            float x1=Mathf.Clamp(safe.xMax,0,full.width),y1=Mathf.Clamp(safe.yMax,0,full.height);
            return x1>x0&&y1>y0?Rect.MinMaxRect(x0,y0,x1,y1):full;
        }
        public static float Radius(Rect safe,int index)=>Mathf.Min(safe.width,safe.height)*(index==0?.105f:index==1?.071f:.055f);
        public static Vector2 Center(Rect safe,Vector2 normalized)=>ClampCenter(safe,safe.min+Vector2.Scale(safe.size,normalized),0);
        public static Vector2 ClampCenter(Rect safe,Vector2 at,float radius){
            radius=Mathf.Clamp(radius,0,Mathf.Min(safe.width,safe.height)*.5f);
            return new Vector2(Mathf.Clamp(at.x,safe.xMin+radius,safe.xMax-radius),Mathf.Clamp(at.y,safe.yMin+radius,safe.yMax-radius));
        }
        public static bool InMovementZone(Rect safe,Vector2 at)=>safe.Contains(at)&&at.x<safe.xMin+safe.width*.42f&&at.y<safe.yMin+safe.height*.52f;
        public static int Nearest(Rect safe,Vector2[] centers,Vector2 at){
            int index=-1;float best=float.PositiveInfinity;
            for(int i=1;i<centers.Length;i++){
                float d=Vector2.Distance(at,Center(safe,centers[i]))/Mathf.Max(1,Radius(safe,i));
                if(d<=1.2f&&d<best){best=d;index=i;}
            }
            return index;
        }
        public static Vector2 Stick(Vector2 delta,float radius){
            var direction=Vector2.ClampMagnitude(delta/Mathf.Max(1,radius),1);
            float length=direction.magnitude;
            return length<=.12f?Vector2.zero:direction.normalized*Mathf.Clamp01((length-.12f)/.88f);
        }
    }
}
