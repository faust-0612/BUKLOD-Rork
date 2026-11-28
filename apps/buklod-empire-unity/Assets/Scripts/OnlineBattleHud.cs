using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    // Read-only snapshot HUD. The shared MobileBattleInput owns all touch gestures.
    public sealed class OnlineBattleHud:MonoBehaviour {
        OnlineSessionController session;
        MobileBattleInput input;
        Canvas canvas;
        Text status,stats;
        readonly Image[] buttons=new Image[9];
        readonly Text[] labels=new Text[9];
        Image knob;
        static readonly string[] Names={"","ATK","S1","S2","ULT","TACTIC","RECALL","MINION","TOWER"};
        internal static OnlineUnit Own(OnlineSnapshot s){
            if(s?.Units==null)return null;
            foreach(var u in s.Units)if(u.Id==s.OwnUnitId&&u.Team==s.Team&&u.Kind==BattleTargetKind.Hero)return u;
            return null;
        }
        internal static string Status(OnlineConnectionState state,OnlineSnapshot s){
            switch(state){
                case OnlineConnectionState.Connecting:return "CONNECTING";
                case OnlineConnectionState.Waiting:return "WAITING FOR PLAYERS";
                case OnlineConnectionState.Reconnecting:return "RECONNECTING • INPUT PAUSED";
                case OnlineConnectionState.Playing:return Own(s)?.Alive==true?"ONLINE MATCH":"RESPAWNING";
                case OnlineConnectionState.Finished:
                    if(s==null||!s.Finished)return "MATCH RESULT UNAVAILABLE";
                    return !s.Winner.HasValue?"DRAW":s.Winner.Value==s.Team?"VICTORY":"DEFEAT";
                case OnlineConnectionState.Unavailable:return "CONNECTION UNAVAILABLE";
                default:return "";
            }
        }
        internal static string Cooldown(OnlineSnapshot s,int button){
            if(s==null||s.Finished)return "";
            float value=0;
            if(button>=2&&button<=4&&s.SkillRemaining!=null&&s.SkillRemaining.Count>=3)value=s.SkillRemaining[button-2];
            if(button==5)value=s.TacticRemaining;
            return value>0?Mathf.CeilToInt(value).ToString():"";
        }
        void Awake(){session=GetComponent<OnlineSessionController>();input=GetComponent<MobileBattleInput>();}
        Image ImageAt(string name,Transform parent,Sprite sprite){
            var go=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer),typeof(Image));go.transform.SetParent(parent,false);
            var i=go.GetComponent<Image>();i.sprite=sprite;i.raycastTarget=false;i.color=new Color(.08f,.16f,.23f,.82f);return i;
        }
        Text TextAt(string name,Transform parent){
            var go=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer),typeof(Text));go.transform.SetParent(parent,false);
            var t=go.GetComponent<Text>();t.font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");t.alignment=TextAnchor.MiddleCenter;t.raycastTarget=false;t.color=Color.white;t.fontStyle=FontStyle.Bold;
            t.resizeTextForBestFit=true;t.resizeTextMinSize=8;t.resizeTextMaxSize=26;return t;
        }
        void Build(){
            var go=new GameObject("Online snapshot HUD",typeof(RectTransform),typeof(Canvas));go.transform.SetParent(transform,false);
            canvas=go.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=50;
            var art=GetComponent<ArenaAuthoredUi>();
            for(int i=0;i<buttons.Length;i++){
                buttons[i]=ImageAt("Online control "+i,canvas.transform,art?(i==0?art.stickPad:art.action):null);
                if(i>0)labels[i]=TextAt(Names[i],buttons[i].transform);
            }
            knob=ImageAt("Joystick",buttons[0].transform,art?art.stickNub:null);knob.color=new Color(.65f,.9f,1,.95f);
            status=TextAt("Connection status",canvas.transform);stats=TextAt("Own snapshot",canvas.transform);
        }
        static void Place(RectTransform rect,Vector2 position,Vector2 size){
            rect.anchorMin=rect.anchorMax=Vector2.zero;rect.pivot=Vector2.one*.5f;
            rect.anchoredPosition=position;rect.sizeDelta=size;
        }
        void Update(){
            if(!session||!input)return;
            var state=session.State;
            if(state==OnlineConnectionState.Idle){if(canvas)canvas.enabled=false;return;}
            if(!canvas)Build();canvas.enabled=true;
            var s=session.Snapshot;var own=Own(s);
            var safe=MobileBattleInput.SafeArea;
            bool playing=state==OnlineConnectionState.Playing&&own?.Alive==true&&!s.Finished;
            status.text=Status(state,s);
            Place(status.rectTransform,new Vector2(safe.center.x,safe.yMax-safe.height*.045f),new Vector2(safe.width*.8f,safe.height*.075f));
            bool showStats=s!=null&&own!=null&&(state==OnlineConnectionState.Playing||state==OnlineConnectionState.Finished);
            stats.gameObject.SetActive(showStats);
            if(showStats){
                stats.text="HP "+Mathf.CeilToInt(own.Health)+"/"+Mathf.CeilToInt(own.MaxHealth)+"  •  MANA "+Mathf.CeilToInt(s.Mana)+"/"+Mathf.CeilToInt(s.MaxMana)+"  •  L"+own.Level+"  •  GOLD "+s.Gold;
                Place(stats.rectTransform,new Vector2(safe.center.x,safe.yMax-safe.height*.12f),new Vector2(safe.width*.82f,safe.height*.075f));
            }
            for(int i=0;i<buttons.Length;i++){
                buttons[i].gameObject.SetActive(playing);if(!playing)continue;
                float radius=MobileBattleInput.Radius(i);
                Place(buttons[i].rectTransform,i==0?input.MovementCenter:MobileBattleInput.PixelCenter(i),Vector2.one*radius*2);
                if(i==0){Place(knob.rectTransform,Vector2.one*radius+input.Joystick*radius*.65f,Vector2.one*radius);continue;}
                string cd=Cooldown(s,i);labels[i].text=Names[i]+(cd.Length>0?"\n"+cd:"");
                Place(labels[i].rectTransform,Vector2.one*radius,Vector2.one*radius*1.8f);
                buttons[i].color=cd.Length>0?new Color(.15f,.18f,.22f,.7f):new Color(.25f,.53f,.74f,.95f);
            }
        }
        void OnDisable(){if(canvas)canvas.enabled=false;}
    }
}
