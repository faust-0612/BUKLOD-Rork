using UnityEngine;
namespace Buklod.Empire {
    // Canonical review geometry, derived from the owner's Genesis Blueprint.
    // Existing spawn, tower, resource, camp and cover coordinates are preserved.
    // Logical dimensions are not the visible shape of the battlefield.
    public static class SculptedRiftLayout {
        public const int BoundarySegments=96;
        public const float Width=OfflineBattle.Width,Height=OfflineBattle.Height;
        public static Vector2 Center=>new Vector2(Width*.5f,Height*.5f);
        static readonly Vector2[] perimeter=CreatePerimeter();
        static Vector2[] CreatePerimeter(){var result=new Vector2[BoundarySegments];for(int i=0;i<result.Length;i++)result[i]=ComputeBoundary(i);return result;}
        public static Vector2 Boundary(int index)=>perimeter[((index%BoundarySegments)+BoundarySegments)%BoundarySegments];
        static Vector2 ComputeBoundary(int index){
            float a=index*(2*Mathf.PI/BoundarySegments),x=Mathf.Cos(a),y=Mathf.Sin(a);
            float radial=Mathf.Pow(Mathf.Pow(Mathf.Abs(x),4)+Mathf.Pow(Mathf.Abs(y),4),-.25f);
            // Gentle, centrally symmetric perimeter variations instead of a box edge.
            radial*=1-.012f*(1-Mathf.Cos(a*8))*.5f;
            return Center+new Vector2(x*Width*.5f,y*Height*.5f)*radial;
        }
        public static bool Contains(Vector2 p,float clearance=0){
            if(float.IsNaN(p.x)||float.IsNaN(p.y)||float.IsInfinity(p.x)||float.IsInfinity(p.y)||clearance<0)return false;
            // Interior fast path stays strictly inside the sampled polygon even at the corners.
            if(clearance<=2&&p.x>=40&&p.x<=Width-40&&p.y>=40&&p.y<=Height-40)return true;
            // Same exact polygon used for the mesh and navigation surface.
            bool inside=false;float d2=float.PositiveInfinity;
            for(int i=0;i<BoundarySegments;i++){
                Vector2 a=Boundary(i),b=Boundary(i+1),v=b-a;
                if((a.y>p.y)!=(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
                float t=Mathf.Clamp01(Vector2.Dot(p-a,v)/v.sqrMagnitude);
                d2=Mathf.Min(d2,(p-a-v*t).sqrMagnitude);
            }
            return inside&&d2>=clearance*clearance;
        }
        public static float RiverX(float z)=>Width*.5f+7*Mathf.Sin((z-Height*.5f)*Mathf.PI*2/Height)+2.5f*Mathf.Sin((z-Height*.5f)*Mathf.PI*4/Height);
        public const float RiverHalfWidth=5.3f;
        public static float LaneHeight(int lane,float x){
            float baseY=Height*(lane==0?.19f:lane==1?.5f:.81f);
            // Preserve spawn and tower alignments; gentle curved outer lanes with
            // matching half-turn symmetry. The center route remains direct.
            if(lane==1)return baseY;
            float d=Mathf.Min(x,Width-x),u=Mathf.Clamp01((d-35)/125);
            float bend=12*Mathf.Sin(Mathf.PI*u)*Mathf.Sin(Mathf.PI*u);
            // The two canonical river-side cover islands lie on the former straight lanes.
            // Curve around their solid footprints, including road width and agent clearance.
            float coverX=lane==0?Width*.52f:Width*.48f;
            float q=Mathf.Clamp01(Mathf.Abs(x-coverX)/30f);
            float detour=12*(1-q*q*(3-2*q));
            return baseY+(lane==0?-(bend+detour):bend+detour);
        }
        public static Vector2 Crossing(int lane){
            float x=Width*.5f;
            for(int i=0;i<12;i++)x=RiverX(LaneHeight(lane,x));
            return new Vector2(x,LaneHeight(lane,x));
        }
        public static Vector2 LanePoint(int lane,int index,int count){
            float x=Mathf.Lerp(19,Width-19,index/(float)count);return new Vector2(x,LaneHeight(lane,x));
        }
        public static Vector2 LaneWaypoint(int lane,Vector2 p,bool lux,Vector2 destination){
            float sign=lux?1:-1;
            float toward=(destination.x-p.x)*sign;
            if(toward<=10||destination.x<19||destination.x>Width-19)return destination;
            // Keep the current combat destination. Waypoints are only approach routing.
            if(Mathf.Abs(p.y-LaneHeight(lane,p.x))>8&&Mathf.Abs(p.x-(lux?19:Width-19))<27)
                return new Vector2(Mathf.Clamp(p.x,19,Width-19),LaneHeight(lane,p.x));
            float x=Mathf.Clamp(p.x+sign*Mathf.Min(12,toward),19,Width-19);
            return new Vector2(x,LaneHeight(lane,x));
        }
        public static Vector3 Cover(int i){
            switch(i){
                case 0:return new Vector3(.29f,.23f,.025f);case 1:return new Vector3(.71f,.77f,.025f);
                case 2:return new Vector3(.42f,.41f,.025f);case 3:return new Vector3(.58f,.59f,.025f);
                case 4:return new Vector3(.48f,.81f,.018f);case 5:return new Vector3(.52f,.19f,.018f);
                default:throw new System.ArgumentOutOfRangeException(nameof(i));
            }
        }
        public const int CoverCount=6;
    }
}
