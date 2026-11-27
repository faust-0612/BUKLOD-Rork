using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    // Fixed-size pool; consumes only already-visible hero samples from BattleView.
    // No hit calculation, hidden-unit queries, network, input or reward mutation.
    [DefaultExecutionOrder(100)]
    public sealed class ReviewCombatOverlay:MonoBehaviour {
        public const int HeroLimit=10,FloatLimit=20;
        sealed class Row {public int id;public bool seen,ally,player;public Vector3 point;public float hp,shield;public int level;public RectTransform root;public Image health,guard;public Text levelText;}
        sealed class Float {public int id;public bool live;public float start;public Vector3 point;public RectTransform root;public Text text;}
        readonly Row[] rows=new Row[HeroLimit];readonly Float[] numbers=new Float[FloatLimit];
        BattleView view;Canvas canvas;RectTransform surface;int cursor;bool focus=true,appPaused;
        static readonly Color Ally=new Color(.26f,.82f,.68f),Enemy=new Color(1,.33f,.32f),Guard=new Color(.52f,.80f,1);
        public static float Fraction(float value,float max)=>float.IsNaN(value)||float.IsInfinity(value)||float.IsNaN(max)||float.IsInfinity(max)||max<=0?0:Mathf.Clamp01(value/max);
        public static int DamageNumber(float amount)=>float.IsNaN(amount)||float.IsInfinity(amount)||amount<=0?0:Mathf.Clamp(Mathf.RoundToInt(Mathf.Min(amount,99999)),0,99999);
        static RectTransform Rect(string name,Transform parent,Vector2 size){
            var g=new GameObject(name,typeof(RectTransform));var r=g.GetComponent<RectTransform>();r.SetParent(parent,false);r.anchorMin=r.anchorMax=Vector2.zero;r.sizeDelta=size;return r;
        }
        static Image Image(string name,Transform parent,Color tint,Vector2 size){
            var r=Rect(name,parent,size);var img=r.gameObject.AddComponent<Image>();img.color=tint;img.raycastTarget=false;return img;
        }
        static Text Text(string name,Transform parent,Vector2 size,int fontSize){
            var r=Rect(name,parent,size);var t=r.gameObject.AddComponent<Text>();t.font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");t.fontSize=fontSize;t.fontStyle=FontStyle.Bold;t.alignment=TextAnchor.MiddleCenter;t.raycastTarget=false;
            var outline=r.gameObject.AddComponent<Outline>();outline.effectColor=new Color(.02f,.025f,.035f,.95f);outline.effectDistance=new Vector2(1,-1);return t;
        }
        internal void Bind(BattleView owner){
            if(!owner||!owner.IsEditorReview)return;view=owner;
            if(!canvas){
                var r=Rect("Visible combat indicators",transform,Vector2.zero);canvas=r.gameObject.AddComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=40;surface=r;
                for(int i=0;i<rows.Length;i++){
                    var root=Rect("Hero overhead "+i,surface,new Vector2(104,22));
                    var back=Image("Track",root,new Color(.025f,.045f,.06f,.95f),new Vector2(82,10));back.rectTransform.anchoredPosition=new Vector2(59,11);
                    var hp=Image("HP",back.transform,Ally,new Vector2(78,6));hp.rectTransform.pivot=new Vector2(0,.5f);hp.rectTransform.anchoredPosition=new Vector2(2,5);
                    var guard=Image("Shield",back.transform,Guard,new Vector2(78,2));guard.rectTransform.pivot=new Vector2(0,.5f);guard.rectTransform.anchoredPosition=new Vector2(2,2);
                    var level=Text("Level",root,new Vector2(23,21),15);level.rectTransform.anchoredPosition=new Vector2(12,11);
                    rows[i]=new Row{root=root,health=hp,guard=guard,levelText=level};root.gameObject.SetActive(false);
                }
                for(int i=0;i<numbers.Length;i++){var t=Text("Damage "+i,surface,new Vector2(100,40),25);numbers[i]=new Float{root=t.rectTransform,text=t};t.gameObject.SetActive(false);}
            }
            ResetOverlay();
        }
        internal void ResetOverlay(){cursor=0;foreach(var row in rows)if(row!=null){row.id=0;row.seen=false;row.root.gameObject.SetActive(false);}foreach(var n in numbers)if(n!=null){n.live=false;n.root.gameObject.SetActive(false);}if(canvas)canvas.enabled=false;}
        internal void BeginFrame(){foreach(var row in rows)if(row!=null)row.seen=false;}
        internal void Observe(int id,Vector3 point,float health,float max,float shield,int level,bool ally,bool player,float damage){
            if(!canvas||id<=0)return;Row row=null,free=null;
            foreach(var r in rows){if(r.id==id){row=r;break;}if(!r.seen&&r.id==0&&free==null)free=r;}
            if(row==null)row=free;
            // If the previous frame used every slot, defer new visibility until next frame.
            if(row==null)return;row.id=id;row.seen=true;row.point=point;row.hp=Fraction(health,max);row.shield=Fraction(shield,max);row.level=level;row.ally=ally;row.player=player;
            int value=DamageNumber(damage);if(value<=0)return;
            var n=numbers[cursor++%FloatLimit];if(cursor>=FloatLimit)cursor=0;
            n.id=id;n.point=point;n.start=Time.unscaledTime;n.live=true;n.text.text=value.ToString();n.text.color=ally?new Color(1,.66f,.42f):new Color(1,.91f,.65f);
        }
        internal void EndFrame(){foreach(var r in rows)if(!r.seen){r.id=0;r.root.gameObject.SetActive(false);}}
        bool Project(Vector3 world,out Vector2 point){
            var q=view.battleCamera.WorldToScreenPoint(world);point=new Vector2(q.x,q.y);return q.z>0&&MobileBattleInput.SafeArea.Contains(point);
        }
        void LateUpdate(){
            if(!canvas)return;bool active=view&&view.Battle!=null&&!view.Paused&&!view.Battle.Finished&&focus&&!appPaused&&view.battleCamera;
            canvas.enabled=active;if(!active){foreach(var n in numbers)if(n!=null){n.live=false;n.root.gameObject.SetActive(false);}return;}
            float scale=Mathf.Clamp(MobileBattleInput.SafeArea.height/720f,.65f,1.55f);
            foreach(var r in rows){
                Vector2 pos=default;bool visible=r.seen&&Project(r.point,out pos);r.root.gameObject.SetActive(visible);if(!visible)continue;
                r.root.anchoredPosition=pos;r.root.localScale=Vector3.one*scale;
                r.health.color=r.ally?Ally:Enemy;r.health.rectTransform.sizeDelta=new Vector2(78*r.hp,6);
                r.guard.rectTransform.sizeDelta=new Vector2(78*r.shield,2);r.levelText.text=r.level.ToString();r.levelText.color=r.player?new Color(1,.85f,.43f):Color.white;
            }
            foreach(var n in numbers){
                if(!n.live)continue;float t=(Time.unscaledTime-n.start)/.85f;bool visibleId=false;foreach(var r in rows)if(r.seen&&r.id==n.id){visibleId=true;break;}
                if(t>=1||!visibleId||!Project(n.point,out var pos)){n.live=false;n.root.gameObject.SetActive(false);continue;}
                n.root.gameObject.SetActive(true);n.root.anchoredPosition=pos+Vector2.up*(20+42*t)*scale;n.root.localScale=Vector3.one*scale*(1+.16f*Mathf.Sin(Mathf.Clamp01(t*4)*Mathf.PI));
                var c=n.text.color;c.a=1-Mathf.SmoothStep(0,1,Mathf.InverseLerp(.5f,1,t));n.text.color=c;
            }
        }
        void Suspend(){if(canvas)canvas.enabled=false;foreach(var n in numbers)if(n!=null){n.live=false;n.root.gameObject.SetActive(false);}}
        void OnApplicationFocus(bool value){focus=value;if(!value)Suspend();}
        void OnApplicationPause(bool value){appPaused=value;if(value)Suspend();}
        void OnDestroy(){if(canvas)Destroy(canvas.gameObject);}
    }
}
