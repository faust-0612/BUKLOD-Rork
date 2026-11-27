using UnityEngine;
namespace Buklod.Empire {
    // Presentation only: bounded reusable visual pulses, never changes combat state.
    public sealed class BattleEffects:MonoBehaviour {
        public Material pulseMaterial;
        public Material skillParticleMaterial;
        public const int Capacity=24, Segments=32;
        private sealed class Pulse {public LineRenderer line;public float start,duration,radius;public Color color;public int style;public bool skill,basicSlash;public SkillCueShape shape;public Vector3 forward;public SkillParticleBurst burst;}
        private Pulse[] pool;private int next;private Camera battleCamera;
        internal Camera previewCamera;
        public void Clear(){if(pool==null)return;foreach(var p in pool){p.line.enabled=false;p.burst?.Stop();}next=0;}
        private void Initialize(){
            if(pool!=null||!pulseMaterial)return;
            pool=new Pulse[Capacity];
            var view=GetComponent<BattleView>();battleCamera=previewCamera?previewCamera:view&&view.battleCamera?view.battleCamera:Camera.main;
            for(int i=0;i<Capacity;i++){
                var go=new GameObject("Pooled combat pulse");go.layer=gameObject.layer;go.transform.SetParent(transform,false);
                var line=go.AddComponent<LineRenderer>();line.sharedMaterial=pulseMaterial;line.useWorldSpace=false;
                line.positionCount=Segments+1;line.loop=false;line.shadowCastingMode=UnityEngine.Rendering.ShadowCastingMode.Off;
                line.receiveShadows=false;line.enabled=false;pool[i]=new Pulse{line=line,burst=skillParticleMaterial?new SkillParticleBurst(transform,skillParticleMaterial):null};
            }
        }
        public static Color Accent(string hero){return SacredStoneCatalog.TryGet(hero,out var stone)?Color.Lerp(stone.Accent,Color.white,.25f):Color.white;}
        public void Emit(Vector3 at,Color color,int style){
            Initialize();if(pool==null)return;
            var p=pool[next];next=(next+1)%Capacity;p.start=Time.unscaledTime;
            p.burst?.Stop();p.skill=false;p.basicSlash=false;p.style=Mathf.Clamp(style,0,4);p.duration=p.style==3?.65f:.32f;
            p.radius=p.style==3?3.5f:p.style==2?2.1f:p.style==1?1.6f:.85f;
            p.color=color;p.line.transform.position=at+Vector3.up*.11f;p.line.enabled=true;Draw(p,0);
        }
        public void EmitSkill(Vector3 at,Color color,SkillCue cue,Vector3 direction){
            Initialize();if(pool==null)return;
            var p=pool[next];next=(next+1)%Capacity;p.start=Time.unscaledTime;p.skill=true;p.basicSlash=false;p.shape=cue.Shape;p.duration=cue.Duration;p.radius=cue.Size;p.color=color;p.style=0;
            direction.y=0;p.forward=direction.sqrMagnitude>.001f?direction.normalized:Vector3.forward;
            p.line.transform.position=at+Vector3.up*.16f;p.line.enabled=true;Draw(p,0);
            p.burst?.Begin(at+Vector3.up*.14f,color,cue,p.forward);p.burst?.Draw(0,battleCamera);
        }
        public void EmitBasic(Vector3 at,Color color,Vector3 forward,bool ranged){
            if(ranged){
                EmitSkill(at+Vector3.up*.65f,color,new SkillCue("basic_ranged_review",SkillCueShape.Bolt,1.3f,.24f,-1),forward);return;
            }
            Initialize();if(pool==null)return;
            var p=pool[next];next=(next+1)%Capacity;p.start=Time.unscaledTime;
            p.skill=false;p.basicSlash=true;p.style=0;p.duration=.26f;p.radius=1.55f;p.color=color;
            forward.y=0;p.forward=forward.sqrMagnitude>.001f?forward.normalized:Vector3.forward;
            p.line.transform.position=at+Vector3.up*.72f;p.line.enabled=true;
            p.burst?.Begin(at+Vector3.up*.5f,color,new SkillCue("basic_melee_review",SkillCueShape.Impact,1.1f,.26f,-1),p.forward);
            Draw(p,0);
        }
        private static void Draw(Pulse p,float t){
            var c=p.color;c.a=(1-t)*.85f;p.line.startColor=c;p.line.endColor=c;
            p.line.widthMultiplier=(p.style==3?.15f:.075f)*(1-.65f*t);
            float radius=p.radius*Mathf.Lerp(.35f,1,t);
            if(p.basicSlash){
                var right=Vector3.Cross(Vector3.up,p.forward);
                p.line.widthMultiplier=.13f*(1-.8f*t);
                for(int i=0;i<=Segments;i++){
                    float u=(float)i/Segments,angle=Mathf.Lerp(-1.3f,1.3f,u)+.5f*t;
                    p.line.SetPosition(i,(right*Mathf.Sin(angle)+p.forward*Mathf.Cos(angle))*p.radius*Mathf.Lerp(.65f,1.1f,t)+Vector3.up*(.16f*Mathf.Sin(u*Mathf.PI)));
                }return;
            }
            if(p.skill){DrawSkill(p,t,radius);return;}
            for(int i=0;i<=Segments;i++){
                float a=i*2*Mathf.PI/Segments;
                float shape=p.style==1?1+.12f*Mathf.Cos(a*4):p.style==2?1+.16f*Mathf.Cos(a*6):p.style==3?1+.10f*Mathf.Cos(a*8):1;
                p.line.SetPosition(i,new Vector3(Mathf.Cos(a)*radius*shape,0,Mathf.Sin(a)*radius*shape));
            }
        }
        private static void DrawSkill(Pulse p,float t,float r){
            var right=Vector3.Cross(Vector3.up,p.forward);
            for(int i=0;i<=Segments;i++){
                float u=(float)i/Segments,a=u*2*Mathf.PI,x=Mathf.Cos(a),z=Mathf.Sin(a),y=0;
                switch(p.shape){
                    case SkillCueShape.Wall:x=(u*2-1)*1.1f;z=.25f+.09f*Mathf.Sin(u*6*Mathf.PI);y=.14f*Mathf.Sin(Mathf.PI*u);break;
                    case SkillCueShape.Dash:x=.24f*Mathf.Sin(u*4*Mathf.PI);z=(u*2-1)*1.3f;break;
                    case SkillCueShape.Bolt:x=.14f*Mathf.Sin(u*6*Mathf.PI);z=u*1.5f;y=.25f*Mathf.Sin(Mathf.PI*u);break;
                    case SkillCueShape.Mark:x*=.55f+.2f*Mathf.Cos(a*4);z*=.55f+.2f*Mathf.Cos(a*4);break;
                    case SkillCueShape.Shield:x*=.94f+.06f*Mathf.Cos(a*6);z*=.94f+.06f*Mathf.Cos(a*6);y=.25f+.3f*Mathf.Abs(Mathf.Sin(a));break;
                    case SkillCueShape.Heal:x*=.75f+.18f*Mathf.Sin(a*4+t*5);z*=.75f+.18f*Mathf.Sin(a*4+t*5);y=.18f+.18f*Mathf.Sin(a*2+t*5);break;
                    case SkillCueShape.Surge:x*=.42f;z*=1.25f;break;
                    case SkillCueShape.Snare:float vine=.8f+.2f*Mathf.Sin(a*7);x*=vine;z*=vine;y=.12f*Mathf.Abs(Mathf.Sin(a*7));break;
                    case SkillCueShape.Summon:float gear=.83f+.15f*Mathf.Cos(a*8);x*=gear;z*=gear;y=.14f;break;
                    case SkillCueShape.Impact:float crack=.82f+.18f*Mathf.Cos(a*5);x*=crack;z*=crack;break;
                }
                p.line.SetPosition(i,(right*x+p.forward*z+Vector3.up*y)*r);
            }
        }
        private void Update(){if(pool==null)return;foreach(var p in pool)if(p.line.enabled){
            float t=(Time.unscaledTime-p.start)/p.duration;
            if(t>=1){p.line.enabled=false;p.burst?.Stop();}
            else{Draw(p,Mathf.Clamp01(t));if(p.skill||p.basicSlash)p.burst?.Draw(Mathf.Clamp01(t),battleCamera);}
        }}
        private void OnDisable(){Clear();}
        private void OnDestroy(){if(pool!=null)foreach(var p in pool)p.burst?.Dispose();}
    }
}
