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
        private Button resume,start,counter;
        private Text counterLabel,stoneDetail,counterNotice;
        private Button[] shop;
        private Text shopStatus;
        private static readonly string[] GearIds={"blade","armor","boots"};
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
            counter=ButtonAt("Practice counter",canvas,new Vector2(.70f,.91f),new Vector2(.88f,.99f),"COUNTER",ActivatePracticeCounter);
            counterLabel=counter.GetComponentInChildren<Text>();
            counterNotice=Label("Counter notice",canvas,new Vector2(.31f,.84f),new Vector2(.69f,.89f),"",20);
            shop=new Button[GearIds.Length];
            for(int i=0;i<GearIds.Length;i++){
                string gear=GearIds[i];float y=.83f-i*.075f;
                shop[i]=ButtonAt("Shop "+gear,canvas,new Vector2(.83f,y),new Vector2(.99f,y+.066f),gear.ToUpperInvariant()+" "+OfflineMatchRules.ShopPrice(gear),()=>Buy(gear));
            }
            shopStatus=Label("Shop status",canvas,new Vector2(.73f,.57f),new Vector2(.99f,.625f),"BASE SHOP",20);
            panel=Rect("Session panel",canvas,Vector2.zero,Vector2.one);
            panel.gameObject.AddComponent<Image>().color=Navy;
            title=Label("Title",panel,new Vector2(.1f,.84f),new Vector2(.9f,.96f),"OFFLINE TRAINING",44);
            summary=Label("Summary",panel,new Vector2(.12f,.72f),new Vector2(.88f,.84f),"5v5 • No internet or persistent rewards",26);
            choice=Label("Selected hero",panel,new Vector2(.1f,.64f),new Vector2(.9f,.72f),"",27);
            stoneDetail=Label("Sacred stone details",panel,new Vector2(.07f,.175f),new Vector2(.93f,.22f),"",19);
            heroGrid=Rect("Heroes",panel,new Vector2(.07f,.22f),new Vector2(.93f,.62f));
            for(int i=0;i<HeroKitCatalog.All.Count;i++){
                var kit=HeroKitCatalog.All[i];int col=i%5,row=i/5;
                float x=col/5f,y=1-(row+1)/3f;
                SacredStoneCatalog.TryGet(kit.Id,out var identity);
                ButtonAt(kit.Id,heroGrid,new Vector2(x+.008f,y+.02f),new Vector2(x+.192f,y+.31f),kit.Name+"\n"+(identity?.Name??""),()=>Select(kit.Id));
            }
            resume=ButtonAt("Resume",panel,new Vector2(.08f,.06f),new Vector2(.46f,.17f),"RESUME",Resume);
            start=ButtonAt("Start",panel,new Vector2(.54f,.06f),new Vector2(.92f,.17f),"START NEW MATCH",StartNew);
            ButtonAt("Collection",panel,new Vector2(.76f,.85f),new Vector2(.98f,.95f),"COLLECTION",OpenCollection);
            Select(selected);Open();
        }
        private void OpenCollection(){
            if(!shown)return;
            var collection=GetComponent<ArenaCommercePanel>();if(!collection)collection=gameObject.AddComponent<ArenaCommercePanel>();
            collection.Open(canvas,()=>Refresh());
        }
        private void Select(string hero){
            selected=HeroKitCatalog.Get(hero).Id;
            SacredStoneCatalog.TryGet(selected,out var stone);
            choice.text="Selected: "+HeroKitCatalog.Get(hero).Name+" / "+(stone?.Name??"");
            var ingredients=ArenaStoneRules.Ingredients(selected);
            if(ingredients.Length==2&&SacredStoneCatalog.TryGet(ingredients[0],out var first)&&SacredStoneCatalog.TryGet(ingredients[1],out var second))
                stoneDetail.text=first.Name+" + "+second.Name+" = "+stone.Name+" • Online: 100 BP / stone • Training: free";
            else stoneDetail.text="Training is free; no persistent stones.";
        }
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
        private void Buy(string gear){
            if(!shown&&!view.Paused&&view.Battle!=null&&!view.Battle.Finished)view.Battle.BuyPlayer(gear);
        }
        private void RefreshShop(){
            var battle=view.Battle;
            if(battle==null)return;
            var p=battle.Player;
            bool atBase=Vector2.Distance(p.Position,p.Spawn)<=12;
            shopStatus.text=atBase?"BASE SHOP":"RETURN TO BASE";
            for(int i=0;i<shop.Length;i++){
                string gear=GearIds[i];bool owned=p.Gear.Contains(gear);
                shop[i].interactable=!shown&&!view.Paused&&!battle.Finished&&p.State.Alive&&atBase&&!owned&&p.Gold>=OfflineMatchRules.ShopPrice(gear);
                shop[i].GetComponentInChildren<Text>().text=owned?gear.ToUpperInvariant()+" ✓":gear.ToUpperInvariant()+" "+OfflineMatchRules.ShopPrice(gear);
            }
        }
        private void ActivatePracticeCounter(){
            var b=view.Battle;var target=b?.PracticeCounterTarget;
            if(shown||view.Paused||target==null)return;
            b.TryPracticeCounter(target.State.Kit.Id,target.Id);
        }
        private void RefreshCounter(){
            var b=view.Battle;var target=b?.PracticeCounterTarget;
            bool visible=!shown&&b!=null&&!b.Finished;
            counter.gameObject.SetActive(visible);
            counterNotice.gameObject.SetActive(visible);
            counter.interactable=visible&&!view.Paused&&target!=null;
            if(b==null){counterLabel.text="COUNTER";counterNotice.text="";return;}
            string name=target==null?"":target.State.Kit.Name;
            if(target!=null&&SacredStoneCatalog.TryGet(target.State.Kit.Id,out var stone))name=stone.Name;
            counterLabel.text=b.PracticeCounterUsed?"COUNTER USED":target==null?"COUNTER: NO TARGET":"COUNTER "+name;
            var active=b.ActivePracticeCounterTarget;
            counterNotice.text=active!=null?active.State.Kit.Name+" • COUNTERED "+Mathf.CeilToInt(b.PracticeCounterRemaining)+"s":"";
        }
        private void Update(){
            RefreshShop();
            RefreshCounter();
            bool finished=view.Battle!=null&&view.Battle.Finished;
            if((finished&&!lastFinished)||(!shown&&view.Paused))Open();
            lastFinished=finished;
        }
        private void OnDestroy(){if(ownedEventSystem)Destroy(ownedEventSystem);}
    }
}
