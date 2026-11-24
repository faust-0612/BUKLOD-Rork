using System;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;

namespace Buklod.Empire {
    // Offline-only session navigation. Never queues online or grants persistent rewards.
    [RequireComponent(typeof(BattleView))]
    public sealed class OfflineSessionMenu:MonoBehaviour {
        private BattleView view;
        private RectTransform canvas,panel,heroGrid;
        private Text title,summary,choice;
        private Button resume,start;
        private GameObject ownedEventSystem;
        private string selected;
        private bool shown,lastFinished;
        private Font font;
        private static readonly Color Navy=new Color(.055f,.09f,.13f,.97f);
        private RectTransform Rect(string name,Transform parent,Vector2 min,Vector2 max){
            var go=new GameObject(name,typeof(RectTransform));var r=go.GetComponent<RectTransform>();
            r.SetParent(parent,false);r.anchorMin=min;r.anchorMax=max;r.offsetMin=r.offsetMax=Vector2.zero;return r;
        }
        private Text Label(string name,Transform parent,Vector2 min,Vector2 max,string value,int size){
            var r=Rect(name,parent,min,max);var t=r.gameObject.AddComponent<Text>();
            t.font=font;t.text=value;t.fontSize=size;t.color=Color.white;t.alignment=TextAnchor.MiddleCenter;
            t.resizeTextForBestFit=true;t.resizeTextMinSize=12;t.resizeTextMaxSize=size;t.raycastTarget=false;return t;
        }
        private Button ButtonAt(string name,Transform parent,Vector2 min,Vector2 max,string value,Action action){
            var r=Rect(name,parent,min,max);var image=r.gameObject.AddComponent<Image>();image.color=new Color(.15f,.31f,.32f,1);
            var b=r.gameObject.AddComponent<Button>();b.targetGraphic=image;b.onClick.AddListener(()=>action());
            Label("Label",r,Vector2.zero,Vector2.one,value,24);return b;
        }
        private void Awake(){
            view=GetComponent<BattleView>();font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            selected=view.selectedHero;
            if(!EventSystem.current){
                ownedEventSystem=new GameObject("Offline UI EventSystem",typeof(EventSystem),typeof(InputSystemUIInputModule));
            }
            canvas=Rect("Offline session UI",transform,Vector2.zero,Vector2.one);
            var c=canvas.gameObject.AddComponent<Canvas>();c.renderMode=RenderMode.ScreenSpaceOverlay;c.sortingOrder=100;
            var scaler=canvas.gameObject.AddComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution=new Vector2(1280,720);scaler.matchWidthOrHeight=.5f;
            canvas.gameObject.AddComponent<GraphicRaycaster>();
            ButtonAt("Menu",canvas,new Vector2(.89f,.91f),new Vector2(.99f,.99f),"MENU",Open);
            panel=Rect("Session panel",canvas,Vector2.zero,Vector2.one);
            panel.gameObject.AddComponent<Image>().color=Navy;
            title=Label("Title",panel,new Vector2(.1f,.84f),new Vector2(.9f,.96f),"OFFLINE TRAINING",44);
            summary=Label("Summary",panel,new Vector2(.12f,.72f),new Vector2(.88f,.84f),"5v5 • No internet or persistent rewards",26);
            choice=Label("Selected hero",panel,new Vector2(.1f,.64f),new Vector2(.9f,.72f),"",27);
            heroGrid=Rect("Heroes",panel,new Vector2(.07f,.22f),new Vector2(.93f,.62f));
            for(int i=0;i<HeroKitCatalog.All.Count;i++){
                var kit=HeroKitCatalog.All[i];int col=i%5,row=i/5;
                float x=col/5f,y=1-(row+1)/3f;
                ButtonAt(kit.Id,heroGrid,new Vector2(x+.008f,y+.02f),new Vector2(x+.192f,y+.31f),kit.Name,()=>Select(kit.Id));
            }
            resume=ButtonAt("Resume",panel,new Vector2(.08f,.06f),new Vector2(.46f,.17f),"RESUME",Resume);
            start=ButtonAt("Start",panel,new Vector2(.54f,.06f),new Vector2(.92f,.17f),"START NEW MATCH",StartNew);
            Select(selected);Open();
        }
        private void Select(string hero){selected=HeroKitCatalog.Get(hero).Id;choice.text="Selected: "+HeroKitCatalog.Get(hero).Name;}
        private void Open(){
            shown=true;view.SetPaused(true);panel.gameObject.SetActive(true);
            Refresh();
        }
        private void Refresh(){
            var b=view.Battle;bool finished=b!=null&&b.Finished;
            title.text=finished?(b.Winner.HasValue?(b.Winner.Value==ArenaTeam.Lux?"VICTORY":"DEFEAT"):"DRAW"):"OFFLINE TRAINING";
            summary.text=finished?"Training complete • No permanent rewards":"5v5 • No internet or persistent rewards";
            resume.interactable=b!=null&&!finished&&b.Time>0;
        }
        private void Resume(){if(view.Battle==null||view.Battle.Finished)return;Close();}
        private void StartNew(){view.StartMatch(selected);lastFinished=false;Close();}
        private void Close(){shown=false;panel.gameObject.SetActive(false);view.SetPaused(false);}
        private void Update(){
            bool finished=view.Battle!=null&&view.Battle.Finished;
            if((finished&&!lastFinished)||(!shown&&view.Paused))Open();
            lastFinished=finished;
        }
        private void OnDestroy(){if(ownedEventSystem)Destroy(ownedEventSystem);}
    }
}
