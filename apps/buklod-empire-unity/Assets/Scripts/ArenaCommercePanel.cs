using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    // Offline catalog visual preview, no billing, no ads, no gameplay state mutations.
    public sealed class ArenaCommercePanel:MonoBehaviour {
        private RectTransform root;
        private Text heading,detail,price,index;
        private Image swatch;
        private RawImage modelPreview;
        private Text visualStatus;
#if UNITY_EDITOR
        public static Func<ArenaOffer,Texture> EditorReviewPreview;
        private float nextPreviewCheck;
        private Func<ArenaOffer,bool> practiceSelected;
        private Button practiceButton;
#endif
        private ArenaPremiumPreviewMotion motion;
        private Font font;
        private ArenaOffer[] offers;
        private int selected;
        private Action closed;
        private readonly System.Collections.Generic.Dictionary<ArenaOfferKind,Sprite> sprites=new System.Collections.Generic.Dictionary<ArenaOfferKind,Sprite>();
        private readonly System.Collections.Generic.List<Texture2D> textures=new System.Collections.Generic.List<Texture2D>();
        private RectTransform Rect(string name,Transform parent,float x,float y,float w,float h){
            var g=new GameObject(name,typeof(RectTransform));var r=g.GetComponent<RectTransform>();
            r.SetParent(parent,false);r.anchorMin=new Vector2(x,y);r.anchorMax=new Vector2(x+w,y+h);r.offsetMin=r.offsetMax=Vector2.zero;return r;
        }
        private Text Label(string name,Transform parent,float x,float y,float w,float h,string value,int size){
            var t=Rect(name,parent,x,y,w,h).gameObject.AddComponent<Text>();
            t.font=font;t.text=value;t.fontSize=size;t.color=Color.white;t.alignment=TextAnchor.MiddleCenter;
            t.resizeTextForBestFit=true;t.resizeTextMinSize=12;t.resizeTextMaxSize=size;t.raycastTarget=false;return t;
        }
        private Button Button(string name,float x,float y,float w,float h,Action act){
            var r=Rect(name,root,x,y,w,h);var img=r.gameObject.AddComponent<Image>();img.color=new Color(.12f,.32f,.29f);
            var b=r.gameObject.AddComponent<Button>();b.targetGraphic=img;b.onClick.AddListener(()=>act());
            Label("Label",r,0,0,1,1,name,24);return b;
        }
        public void Open(Transform parent,Action onClose
#if UNITY_EDITOR
            ,Func<ArenaOffer,bool> onPracticeSelect=null
#endif
        ){
#if UNITY_EDITOR
            practiceSelected=onPracticeSelect;
#endif
            if(root){root.gameObject.SetActive(true);closed=onClose;root.SetAsLastSibling();Refresh();return;}
            closed=onClose;font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            offers=ArenaCommercePreview.Build().ToArray();
            root=Rect("Arena collection preview",parent,0,0,1,1);
            root.gameObject.AddComponent<Image>().color=new Color(.035f,.065f,.09f,1);
            Label("Title",root,.1f,.85f,.8f,.12f,"ARENA COLLECTION",42);
            index=Label("Index",root,.1f,.76f,.8f,.08f,"",22);
            swatch=Rect("Faceted visual swatch",root,.36f,.40f,.28f,.34f).gameObject.AddComponent<Image>();
            swatch.preserveAspect=true;swatch.raycastTarget=false;
            motion=swatch.gameObject.AddComponent<ArenaPremiumPreviewMotion>();
            modelPreview=Rect("Reviewed model thumbnail",root,.29f,.40f,.42f,.34f).gameObject.AddComponent<RawImage>();
            modelPreview.raycastTarget=false;modelPreview.gameObject.SetActive(false);
            visualStatus=Label("Visual status",root,.28f,.735f,.44f,.035f,"",16);
            heading=Label("Offer",root,.1f,.30f,.8f,.10f,"",32);
            detail=Label("Details",root,.1f,.22f,.8f,.08f,"",19);
            price=Label("Price",root,.1f,.14f,.8f,.08f,"",22);
            Button("PREVIOUS",.04f,.42f,.23f,.12f,()=>Move(-1));
            Button("NEXT",.73f,.42f,.23f,.12f,()=>Move(1));
            Button("NEXT CATEGORY",.06f,.035f,.40f,.09f,NextCategory);
            Button("BACK",.54f,.035f,.40f,.09f,Close);
#if UNITY_EDITOR
            practiceButton=Button("TRY IN TRAINING",.72f,.56f,.25f,.12f,TryPractice);
#endif
            Refresh();
        }
        private void Move(int step){selected=(selected+step+offers.Length)%offers.Length;Refresh();}
        private void NextCategory(){
            var kinds=(ArenaOfferKind[])Enum.GetValues(typeof(ArenaOfferKind));int start=Array.IndexOf(kinds,offers[selected].Kind);
            for(int i=1;i<=kinds.Length;i++){
                var next=kinds[(start+i)%kinds.Length];int found=Array.FindIndex(offers,o=>o.Kind==next);
                if(found>=0){selected=found;Refresh();return;}
            }
        }
        // Procedural category emblems: not claims of actual skin/model availability.
        private Sprite Emblem(ArenaOfferKind kind){
            if(sprites.TryGetValue(kind,out var existing))return existing;
            var tex=new Texture2D(192,192,TextureFormat.RGBA32,false);
            var pixels=new Color[192*192];
            for(int y=0;y<192;y++)for(int x=0;x<192;x++){
                float a=(x-95.5f)/88f,b=(y-95.5f)/88f,r=Mathf.Sqrt(a*a+b*b);
                bool ring=r>.83f&&r<.95f;
                bool body;
                switch(kind){
                    case ArenaOfferKind.Stone:body=Mathf.Abs(a)+Mathf.Abs(b)*.82f<.67f;break;
                    case ArenaOfferKind.HeroSkin:case ArenaOfferKind.Villager:case ArenaOfferKind.Minion:
                        body=a*a+(b-.33f)*(b-.33f)<.20f*.20f||(b<.08f&&b>-.58f&&Mathf.Abs(a)<.55f-.22f*Mathf.Abs(b+.15f));break;
                    case ArenaOfferKind.Weapon:body=Mathf.Abs(a-b)<.10f&&Mathf.Abs(a+b)<1.15f||Mathf.Abs(a+b+.38f)<.08f&&Mathf.Abs(a-b)<.43f;break;
                    case ArenaOfferKind.Building:case ArenaOfferKind.Battlefield:
                        body=Mathf.Abs(a)<.55f&&b<.12f&&b>-.58f||b>=.12f&&b<.66f&&Mathf.Abs(a)<.73f-b;break;
                    case ArenaOfferKind.Voice:body=Mathf.Abs(a)<.55f&&Mathf.Abs(b)<(.20f+.32f*Mathf.Abs(Mathf.Sin(a*14f)));break;
                    case ArenaOfferKind.Bundle:body=Mathf.Abs(a)<.55f&&Mathf.Abs(b)<.50f&&Mathf.Abs(a)>.055f&&Mathf.Abs(b-.13f)>.055f;break;
                    case ArenaOfferKind.Replay:body=a>-.35f&&a<.55f&&Mathf.Abs(b)<(.55f-a)*.68f;break;
                    case ArenaOfferKind.Marketplace:body=Mathf.Abs(b-.25f)<.09f&&Mathf.Abs(a)<.50f||Mathf.Abs(b+.25f)<.09f&&Mathf.Abs(a)<.50f||Mathf.Abs(a-.40f)+Mathf.Abs(b-.25f)<.24f||Mathf.Abs(a+.40f)+Mathf.Abs(b+.25f)<.24f;break;
                    default:body=r<.60f&&r<.30f+.29f*Mathf.Abs(Mathf.Cos(Mathf.Atan2(b,a)*4f));break;
                }
                float light=Mathf.Clamp01(.70f+a*.19f+b*.18f+(a*b>0?.11f:0));
                pixels[y*192+x]=body?new Color(light,light,light,1):ring?new Color(.62f,.62f,.62f,.85f):Color.clear;
            }
            tex.SetPixels(pixels);tex.Apply(false,true);
            var sp=Sprite.Create(tex,new Rect(0,0,192,192),new Vector2(.5f,.5f));textures.Add(tex);sprites.Add(kind,sp);return sp;
        }
        private void Refresh(){
            var o=offers[selected];swatch.sprite=Emblem(o.Kind);swatch.color=o.Accent;motion.Configure(o);RefreshPreview();
            heading.text=o.Name;index.text=o.Kind+" • "+(selected+1)+" / "+offers.Length;
            detail.text=o.Kind==ArenaOfferKind.Stone?"100 BP • One per online match • Free training":o.Kind==ArenaOfferKind.Marketplace?"BP only • No cash-out • Preview only":o.IsBusinessInquiry?"Business inquiry • Not an in-app checkout":"Cosmetic / service concept • No combat advantage";
            price.text=o.Kind==ArenaOfferKind.Marketplace?"Trading unavailable in preview":(o.IsBusinessInquiry?"From PHP "+o.IndicativePhp:o.IndicativePhp==0?"Original / free":"Indicative PHP "+o.IndicativePhp)+" • Preview only";
        }
        private void RefreshPreview(){
            Texture preview=null;
#if UNITY_EDITOR
            if(EditorReviewPreview!=null)preview=EditorReviewPreview(offers[selected]);
#endif
            bool available=preview!=null;
            modelPreview.texture=preview;modelPreview.gameObject.SetActive(available);swatch.gameObject.SetActive(!available);
            visualStatus.text=available?"3D MODEL THUMBNAIL • REVIEW ONLY":"CONCEPT EMBLEM • MODEL NOT DISPLAYED";
#if UNITY_EDITOR
            if(practiceButton)practiceButton.gameObject.SetActive(available&&practiceSelected!=null&&ArenaCosmeticPractice.IsSupported(offers[selected]));
#endif
        }
#if UNITY_EDITOR
        private void TryPractice(){
            if(practiceSelected!=null&&practiceSelected(offers[selected]))Close();
            else detail.text="Select the matching hero first. No purchase or ownership granted.";
        }
        private void Update(){
            if(!root||!root.gameObject.activeInHierarchy||modelPreview.gameObject.activeSelf||Time.unscaledTime<nextPreviewCheck)return;
            nextPreviewCheck=Time.unscaledTime+1f;RefreshPreview();
        }
#endif
        private void Close(){if(root)root.gameObject.SetActive(false);closed?.Invoke();}
        private void OnDestroy(){if(root)Destroy(root.gameObject);foreach(var sp in sprites.Values)if(sp)Destroy(sp);foreach(var tex in textures)if(tex)Destroy(tex);}
    }
}
