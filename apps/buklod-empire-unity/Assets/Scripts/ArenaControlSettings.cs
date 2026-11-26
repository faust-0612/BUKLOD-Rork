using UnityEngine;
namespace Buklod.Empire {
    // Local device preferences only. No changes to combat, rewards, or server state.
    public static class ArenaControlSettings {
        const string Key="buklod.empire.hud.v1.";
        static readonly Vector2[] DefaultCenters={new Vector2(.14f,.22f),new Vector2(.87f,.18f),new Vector2(.73f,.22f),new Vector2(.82f,.40f),new Vector2(.94f,.40f),new Vector2(.69f,.40f),new Vector2(.56f,.23f),new Vector2(.78f,.075f),new Vector2(.95f,.075f)};
        static readonly Vector2[] centers=(Vector2[])DefaultCenters.Clone();
        static readonly float[] scales=new float[DefaultCenters.Length];
        public static int Revision{get;private set;}
        public static float Zoom{get;private set;}
        public static bool DetailedInfo{get;private set;}
        public static bool Fullscreen{get;private set;}
        static ArenaControlSettings(){
            for(int i=0;i<centers.Length;i++){
                centers[i]=new Vector2(Clamp(PlayerPrefs.GetFloat(Key+i+".x",DefaultCenters[i].x),.03f,.97f,DefaultCenters[i].x),Clamp(PlayerPrefs.GetFloat(Key+i+".y",DefaultCenters[i].y),.03f,.65f,DefaultCenters[i].y));
                scales[i]=Clamp(PlayerPrefs.GetFloat(Key+i+".scale",1),.75f,1.5f,1);
            }
            Zoom=Clamp(PlayerPrefs.GetFloat(Key+"zoom",1),.8f,1.35f,1);
            DetailedInfo=PlayerPrefs.GetInt(Key+"info",1)!=0;
            Fullscreen=PlayerPrefs.GetInt(Key+"fullscreen",1)!=0;
        }
        static float Clamp(float value,float min,float max,float fallback)=>float.IsNaN(value)||float.IsInfinity(value)?fallback:Mathf.Clamp(value,min,max);
        public static Vector2[] Centers=> (Vector2[])centers.Clone();
        public static float Scale(int i)=>scales[i];
        public static float Radius(Rect safe,int i)=>ArenaTouchLayout.Radius(safe,i)*scales[i];
        public static Vector2 Center(Rect safe,int i)=>ArenaTouchLayout.ClampCenter(safe,ArenaTouchLayout.Center(safe,centers[i]),Radius(safe,i));
        public static bool InMovementZone(Rect safe,Vector2 at)=>safe.Contains(at)&&(centers[0]==DefaultCenters[0]?ArenaTouchLayout.InMovementZone(safe,at):Vector2.Distance(at,Center(safe,0))<=Radius(safe,0)*2.2f);
        public static int Nearest(Rect safe,Vector2 at){
            int hit=-1;float distance=float.PositiveInfinity;
            for(int i=1;i<centers.Length;i++){float d=Vector2.Distance(at,Center(safe,i))/Mathf.Max(1,Radius(safe,i));if(d<=1.2f&&d<distance){distance=d;hit=i;}}
            return hit;
        }
        public static bool Adjust(int i,Vector2 delta,float size,Rect safe){
            if(i<0||i>=centers.Length)return false;
            float scale=Clamp(scales[i]+size,.75f,1.5f,scales[i]),radius=ArenaTouchLayout.Radius(safe,i)*scale;
            var old=Center(safe,i);
            var at=ArenaTouchLayout.ClampCenter(safe,old+Vector2.Scale(safe.size,delta),radius);
            at.y=Mathf.Min(at.y,safe.yMin+safe.height*.65f-radius);
            if(!safe.Contains(at))return false;
            for(int j=0;j<centers.Length;j++)if(j!=i){
                float combined=radius+Radius(safe,j);
                float nextDistance=Vector2.Distance(at,Center(safe,j)),oldDistance=Vector2.Distance(old,Center(safe,j));
                if(nextDistance<combined&&nextDistance-combined<oldDistance-(Radius(safe,i)+Radius(safe,j))-.01f)return false;
            }
            centers[i]=new Vector2((at.x-safe.xMin)/safe.width,(at.y-safe.yMin)/safe.height);scales[i]=scale;Persist();return true;
        }
        public static void ChangeZoom(float delta){Zoom=Clamp(Zoom+delta,.8f,1.35f,1);Persist();}
        public static void ToggleInfo(){DetailedInfo=!DetailedInfo;Persist();}
        public static void ApplyFullscreen(){Screen.fullScreen=Fullscreen;}
        public static void ToggleFullscreen(){Fullscreen=!Fullscreen;ApplyFullscreen();Persist();}
        public static void Reset(){for(int i=0;i<centers.Length;i++){centers[i]=DefaultCenters[i];scales[i]=1;}Zoom=1;DetailedInfo=true;Fullscreen=true;ApplyFullscreen();Persist();}
        static void Persist(){
            for(int i=0;i<centers.Length;i++){PlayerPrefs.SetFloat(Key+i+".x",centers[i].x);PlayerPrefs.SetFloat(Key+i+".y",centers[i].y);PlayerPrefs.SetFloat(Key+i+".scale",scales[i]);}
            PlayerPrefs.SetFloat(Key+"zoom",Zoom);PlayerPrefs.SetInt(Key+"info",DetailedInfo?1:0);PlayerPrefs.SetInt(Key+"fullscreen",Fullscreen?1:0);PlayerPrefs.Save();Revision++;
        }
    }
}
