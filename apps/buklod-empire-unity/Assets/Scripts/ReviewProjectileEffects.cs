using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    // Short cosmetic tracers of confirmed instant hits; never a projectile hitbox.
    [DisallowMultipleComponent]
    public sealed class ReviewProjectileEffects:MonoBehaviour {
        const int Capacity=8,Segments=8;
        sealed class Shot {public LineRenderer trail,core;public Vector3 from,to;public Vector2 source,destination;public float start,duration;public bool skill;public Color tint;}
        readonly Shot[] pool=new Shot[Capacity];BattleView view;Material material;OfflineBattle match;int cursor,next;
        public static float Flight(float distance,bool skill)=>Mathf.Clamp(distance/(skill?65f:80f),.055f,.19f);
        public static Vector3 Point(Vector3 from,Vector3 to,float t,bool skill){t=Mathf.Clamp01(t);return Vector3.Lerp(from,to,t)+Vector3.up*(Mathf.Sin(t*Mathf.PI)*(skill?.23f:.10f));}
        internal void Bind(BattleView owner,Material shared){Clear();view=owner;material=shared;match=owner.Battle;cursor=0;}
        LineRenderer Line(Transform parent,string name){
            var go=new GameObject(name);go.transform.SetParent(parent,false);go.layer=gameObject.layer;var line=go.AddComponent<LineRenderer>();
            line.sharedMaterial=material;line.useWorldSpace=true;line.positionCount=Segments+1;line.shadowCastingMode=ShadowCastingMode.Off;line.receiveShadows=false;line.enabled=false;return line;
        }
        void Hide(Shot shot){if(shot==null)return;shot.trail.enabled=false;shot.core.enabled=false;}
        public void Clear(){foreach(var shot in pool)Hide(shot);next=0;if(match!=null&&match.ProjectileFeed!=null)cursor=match.ProjectileFeed.Sequence;}
        bool Visible(Vector2 p)=>view&&match!=null&&match.IsPositionVisibleTo(match.Player.Team,p);
        internal void Consume(bool immediate){
            if(!view||!view.IsEditorReview||!material||match==null||view.Battle!=match||match.ProjectileFeed==null)return;
            var feed=match.ProjectileFeed;
            if(immediate||view.Paused||match.Finished){cursor=feed.Sequence;return;}
            cursor=Mathf.Max(cursor,feed.Sequence-ReviewProjectileFeed.Capacity);
            while(cursor<feed.Sequence){
                if(!feed.TryGet(++cursor,out var row)||match.Time-row.Time>.18f||!Visible(row.From)||!Visible(row.To))continue;
                var from=view.FieldPosition(row.From)+Vector3.up*(.82f*view.worldScale);var to=view.FieldPosition(row.To)+Vector3.up*(.70f*view.worldScale);
                if(!view.battleCamera)continue;var a=view.battleCamera.WorldToViewportPoint(from);var b=view.battleCamera.WorldToViewportPoint(to);
                if(!OnScreen(a)||!OnScreen(b))continue;
                var shot=pool[next];if(shot==null){shot=new Shot{trail=Line(transform,"Confirmed projectile trail"),core=Line(transform,"Confirmed projectile core")};pool[next]=shot;}next=(next+1)%Capacity;
                shot.from=from;shot.to=to;shot.source=row.From;shot.destination=row.To;shot.start=Time.unscaledTime;shot.duration=Flight(Vector3.Distance(from,to),row.Skill);shot.skill=row.Skill;shot.tint=BattleEffects.Accent(row.Hero);
                shot.trail.enabled=shot.core.enabled=true;Draw(shot,0);
            }
        }
        static bool OnScreen(Vector3 p)=>p.z>0&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
        void Draw(Shot shot,float t){
            float lead=Mathf.Clamp01(t),tail=Mathf.Max(0,lead-.38f);var color=shot.tint;color.a=.8f*(1-.5f*lead);
            shot.trail.startColor=new Color(color.r,color.g,color.b,0);shot.trail.endColor=color;
            shot.core.startColor=new Color(1,1,1,0);shot.core.endColor=new Color(1,1,1,.92f);
            shot.trail.widthMultiplier=(shot.skill?.16f:.10f)*view.worldScale;shot.core.widthMultiplier=shot.trail.widthMultiplier*.42f;
            for(int i=0;i<=Segments;i++){var p=Point(shot.from,shot.to,Mathf.Lerp(tail,lead,(float)i/Segments),shot.skill);shot.trail.SetPosition(i,p);shot.core.SetPosition(i,p);}
        }
        void LateUpdate(){
            if(!view||view.Paused||match==null||view.Battle!=match||match.Finished||!Application.isFocused){Clear();return;}
            foreach(var shot in pool)if(shot!=null&&shot.trail.enabled){float t=(Time.unscaledTime-shot.start)/shot.duration;if(t>=1||!Visible(shot.source)||!Visible(shot.destination))Hide(shot);else Draw(shot,Mathf.Clamp01(t));}
        }
        void OnApplicationPause(bool value){if(value)Clear();}
        void OnApplicationFocus(bool value){if(!value)Clear();}
        void OnDisable(){Clear();}
        void OnDestroy(){foreach(var shot in pool)if(shot!=null){if(shot.trail)Destroy(shot.trail.gameObject);if(shot.core)Destroy(shot.core.gameObject);}}
    }
}
