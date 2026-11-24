using System;
using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    // Preview stage only. These curves never represent targeting, hitboxes or combat authority.
    public enum PremiumCinematicKind { Entrance, Signature, Victory, Recall }
    public sealed class PremiumCinematicStage:MonoBehaviour {
        public Material pulseMaterial;
        public GameObject[] heroes;
        public string[] labels;
        public Camera stageCamera;
        public const int Rings=4,Segments=72;
        private LineRenderer[] lines;
        private GameObject actor;
        private int index;
        private float elapsed=10;
        private PremiumCinematicKind kind;
        private Color tint=Color.white;
        public static float Duration(PremiumCinematicKind k)=>k==PremiumCinematicKind.Victory?2.4f:k==PremiumCinematicKind.Signature?1.1f:1.8f;
        public static Vector3 Point(PremiumCinematicKind k,int layer,float u,float progress){
            float t=Mathf.Clamp01(progress),a=u*Mathf.PI*2;
            float r,y,angle=a;
            switch(k){
                case PremiumCinematicKind.Entrance:
                    r=(.45f+layer*.25f)*(1+.40f*Mathf.Sin(Mathf.PI*t));y=.13f+layer*.26f+t*1.5f;angle+=t*4+layer*.35f;break;
                case PremiumCinematicKind.Signature:
                    r=(.24f+t*1.25f+layer*.09f)*(1+.12f*Mathf.Cos(a*6+t*8+layer));y=.08f+layer*.07f+.12f*Mathf.Sin(a*3+t*6);break;
                case PremiumCinematicKind.Victory:
                    r=(.55f+layer*.19f)*(1+.12f*Mathf.Cos(a*5+layer));y=.22f+layer*.29f+.13f*Mathf.Sin(a*5+t*5);angle+=t*3;break;
                default:
                    r=Mathf.Max(.10f,(1.2f-layer*.14f)*(1-.78f*t));y=.10f+layer*.31f+t*1.6f;angle-=t*5+layer*.3f;break;
            }
            return new Vector3(Mathf.Cos(angle)*r,y,Mathf.Sin(angle)*r);
        }
        private void Start(){
            if(!pulseMaterial||heroes==null||heroes.Length==0||labels==null||labels.Length!=heroes.Length||!stageCamera){enabled=false;return;}
            lines=new LineRenderer[Rings];
            for(int i=0;i<Rings;i++){
                var obj=new GameObject("Cinematic ribbon "+i);obj.transform.SetParent(transform,false);
                var line=obj.AddComponent<LineRenderer>();line.sharedMaterial=pulseMaterial;
                line.useWorldSpace=false;line.positionCount=Segments+1;line.shadowCastingMode=ShadowCastingMode.Off;
                line.receiveShadows=false;line.enabled=false;lines[i]=line;
            }
            Select(0);
        }
        private void Select(int next){
            index=(next+heroes.Length)%heroes.Length;
            if(actor){actor.SetActive(false);Destroy(actor);}
            actor=Instantiate(heroes[index],transform);actor.transform.localPosition=Vector3.zero;actor.transform.localRotation=Quaternion.identity;
            var heroId=labels[index].Split('/')[0];
            tint=SacredStoneCatalog.TryGet(heroId,out var stone)?stone.Accent:Color.white;
            Play(PremiumCinematicKind.Entrance);
        }
        private void Play(PremiumCinematicKind value){
            kind=value;elapsed=0;
            var animator=actor?actor.GetComponentInChildren<Animator>(true):null;
            string trigger=value==PremiumCinematicKind.Victory?"Victory":value==PremiumCinematicKind.Signature?"Ultimate":null;
            if(animator&&trigger!=null)foreach(var param in animator.parameters)if(param.type==AnimatorControllerParameterType.Trigger&&param.name==trigger){animator.SetTrigger(trigger);break;}
        }
        private void Update(){
            if(lines==null)return;
            elapsed+=Mathf.Min(Time.unscaledDeltaTime,.05f);
            float t=Mathf.Clamp01(elapsed/Duration(kind)),alpha=Mathf.Sin(t*Mathf.PI);
            for(int layer=0;layer<Rings;layer++){
                var line=lines[layer];line.enabled=t<1;
                if(!line.enabled)continue;
                var c=Color.Lerp(tint,layer%2==0?new Color(1,.83f,.42f):Color.white,.32f);c.a=alpha*.75f;
                line.startColor=c;line.endColor=c;line.widthMultiplier=(.018f+layer*.008f)*(.35f+alpha);
                for(int i=0;i<=Segments;i++)line.SetPosition(i,Point(kind,layer,(float)i/Segments,t));
            }
        }
        private void OnGUI(){
            if(lines==null)return;
            GUILayout.BeginArea(new Rect(12,12,Mathf.Min(Screen.width-24,430),260),GUI.skin.box);
            GUILayout.Label("REVIEW ONLY | "+labels[index]);
            GUILayout.BeginHorizontal();if(GUILayout.Button("Previous"))Select(index-1);if(GUILayout.Button("Next"))Select(index+1);GUILayout.EndHorizontal();
            foreach(PremiumCinematicKind k in Enum.GetValues(typeof(PremiumCinematicKind)))if(GUILayout.Button(k.ToString()))Play(k);
            GUILayout.Label("Material and cinematic preview — no entitlement or battle state.");
            GUILayout.EndArea();
        }
    }
}
