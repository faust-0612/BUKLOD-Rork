using UnityEngine;
namespace Buklod.Empire {
    // Presentation only: bounded reusable visual pulses, never changes combat state.
    public sealed class BattleEffects:MonoBehaviour {
        public Material pulseMaterial;
        public const int Capacity=24, Segments=32;
        private sealed class Pulse {public LineRenderer line;public float start,duration,radius;public Color color;public int style;}
        private Pulse[] pool;private int next;
        public void Clear(){if(pool==null)return;foreach(var p in pool)p.line.enabled=false;next=0;}
        private void Initialize(){
            if(pool!=null||!pulseMaterial)return;
            pool=new Pulse[Capacity];
            for(int i=0;i<Capacity;i++){
                var go=new GameObject("Pooled combat pulse");go.transform.SetParent(transform,false);
                var line=go.AddComponent<LineRenderer>();line.sharedMaterial=pulseMaterial;line.useWorldSpace=false;
                line.positionCount=Segments+1;line.loop=false;line.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;
                line.receiveShadows=false;line.enabled=false;pool[i]=new Pulse{line=line};
            }
        }
        public static Color Accent(string hero){return SacredStoneCatalog.TryGet(hero,out var stone)?Color.Lerp(stone.Accent,Color.white,.25f):Color.white;}
        public void Emit(Vector3 at,Color color,int style){
            Initialize();if(pool==null)return;
            var p=pool[next];next=(next+1)%Capacity;p.start=Time.unscaledTime;
            p.style=Mathf.Clamp(style,0,4);p.duration=p.style==3?.65f:.32f;
            p.radius=p.style==3?3.5f:p.style==2?2.1f:p.style==1?1.6f:.85f;
            p.color=color;p.line.transform.position=at+Vector3.up*.11f;p.line.enabled=true;Draw(p,0);
        }
        private static void Draw(Pulse p,float t){
            var c=p.color;c.a=(1-t)*.85f;p.line.startColor=c;p.line.endColor=c;
            p.line.widthMultiplier=(p.style==3?.15f:.075f)*(1-.65f*t);
            float radius=p.radius*Mathf.Lerp(.35f,1,t);
            for(int i=0;i<=Segments;i++){
                float a=i*2*Mathf.PI/Segments;
                float shape=p.style==1?1+.12f*Mathf.Cos(a*4):p.style==2?1+.16f*Mathf.Cos(a*6):p.style==3?1+.10f*Mathf.Cos(a*8):1;
                p.line.SetPosition(i,new Vector3(Mathf.Cos(a)*radius*shape,0,Mathf.Sin(a)*radius*shape));
            }
        }
        private void Update(){if(pool==null)return;foreach(var p in pool)if(p.line.enabled){
            float t=(Time.unscaledTime-p.start)/p.duration;
            if(t>=1)p.line.enabled=false;else Draw(p,Mathf.Clamp01(t));
        }}
        private void OnDisable(){Clear();}
    }
}
