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
        private Font font;
        private ArenaOffer[] offers;
        private int selected;
        private Action closed;
        private Texture2D texture;
        private Sprite sprite;
        private RectTransform Rect(string name,Transform parent,float x,float y,float w,float h){
            var g=new GameObject(name,typeof(RectTransform));var r=g.GetComponent<RectTransform>();
            r.SetParent(parent,false);r.anchorMin=new Vector2(x,y);r.anchorMax=new Vector2(x+w,y+h);r.offsetMin=r.offsetMax=Vector2.zero;return r;
        }
        private Text Label(string name,Transform parent,float x,float y,float w,float h,string value,int size){
            var t=Rect(name,parent,x,y,w,h).gameObject.AddComponent<Text>();
            t.font=font;t.text=value;t.fontSize=size;t.color=Color.white;t.alignment=TextAnchor.MiddleCenter;
            t.resizeTextForBestFit=true;t.resizeTextMinSize=12;t.resizeTextMaxSize=size;t.raycastTarget=false;return t;
        }
        private void Button(string name,float x,float y,float w,float h,Action act){
            var r=Rect(name,root,x,y,w,h);var img=r.gameObject.AddComponent<Image>();img.color=new Color(.12f,.32f,.29f);
            var b=r.gameObject.AddComponent<Button>();b.targetGraphic=img;b.onClick.AddListener(()=>act());
            Label("Label",r,0,0,1,1,name,24);
        }
        public void Open(Transform parent,Action onClose){
            if(root){root.gameObject.SetActive(true);closed=onClose;root.SetAsLastSibling();return;}
            closed=onClose;font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            offers=ArenaCommercePreview.Build().ToArray();
            root=Rect("Arena collection preview",parent,0,0,1,1);
            root.gameObject.AddComponent<Image>().color=new Color(.035f,.065f,.09f,1);
            Label("Title",root,.1f,.85f,.8f,.12f,"ARENA COLLECTION",42);
            index=Label("Index",root,.1f,.76f,.8f,.08f,"",22);
            swatch=Rect("Faceted visual swatch",root,.36f,.40f,.28f,.34f).gameObject.AddComponent<Image>();
            swatch.preserveAspect=true;swatch.raycastTarget=false;
            texture=new Texture2D(128,128,TextureFormat.RGBA32,false);texture.name="Arena preview jewel";
            var pixels=new Color[128*128];
            for(int y=0;y<128;y++)for(int x=0;x<128;x++){
                float a=(x-63.5f)/58f,b=(y-63.5f)/58f;
                float d=Mathf.Abs(a)+Mathf.Abs(b)*.82f;
                float shine=Mathf.Clamp01(.55f+a*.24f+b*.2f+(a*b>0?.17f:0));
                pixels[y*128+x]=d>1?Color.clear:new Color(shine,shine,shine,d>.94f?.85f:1);
            }
            texture.SetPixels(pixels);texture.Apply(false,true);
            sprite=Sprite.Create(texture,new Rect(0,0,128,128),new Vector2(.5f,.5f));swatch.sprite=sprite;
            heading=Label("Offer",root,.1f,.30f,.8f,.10f,"",32);
            detail=Label("Details",root,.1f,.22f,.8f,.08f,"",19);
            price=Label("Price",root,.1f,.14f,.8f,.08f,"",22);
            Button("PREVIOUS",.04f,.42f,.23f,.12f,()=>Move(-1));
            Button("NEXT",.73f,.42f,.23f,.12f,()=>Move(1));
            Button("NEXT CATEGORY",.06f,.035f,.40f,.09f,NextCategory);
            Button("BACK",.54f,.035f,.40f,.09f,Close);
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
        private void Refresh(){
            var o=offers[selected];swatch.color=o.Accent;
            heading.text=o.Name;index.text=o.Kind+" • "+(selected+1)+" / "+offers.Length;
            detail.text=o.Kind==ArenaOfferKind.Stone?"100 BP • One per online match • Free training":"Cosmetic / service concept • No combat advantage";
            price.text=(o.IndicativePhp==0?"Original / free":"Indicative PHP "+o.IndicativePhp)+" • Preview only";
        }
        private void Close(){if(root)root.gameObject.SetActive(false);closed?.Invoke();}
        private void OnDestroy(){if(root)Destroy(root.gameObject);if(sprite)Destroy(sprite);if(texture)Destroy(texture);}
    }
}
