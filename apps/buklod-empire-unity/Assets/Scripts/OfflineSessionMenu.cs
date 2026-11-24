using System;
using System.Linq;
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
        private RectTransform commands;
        private Text commandStatus,settingsText,bankText;
        private Button[] shop;
        private static readonly string[] GearIds={"blade","armor","boots","sealbreaker","withering_thorn","precision","fervor","renewal","wisdom","aegis","vitality","giantbane"};
        private ArenaDifficulty difficulty=ArenaDifficulty.Normal;
        private ArenaTactic tactic=ArenaTactic.Renew;
        private CovenantPath path=CovenantPath.Valor;
        private int first,second,third,seed=1;
        private bool autonomous,commandOpen;
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
            ButtonAt("Commands",canvas,new Vector2(.75f,.91f),new Vector2(.88f,.99f),"ORDERS",OpenCommands);
            ButtonAt("Recall",canvas,new Vector2(.57f,.82f),new Vector2(.72f,.89f),"RECALL",()=>{if(!shown&&!commandOpen&&!view.Paused)view.Battle?.RecallPlayer();});
            bankText=Label("Treasury",canvas,new Vector2(.02f,.74f),new Vector2(.42f,.81f),"",20);
            panel=Rect("Session panel",canvas,Vector2.zero,Vector2.one);
            panel.gameObject.AddComponent<Image>().color=Navy;
            title=Label("Title",panel,new Vector2(.1f,.84f),new Vector2(.9f,.96f),"OFFLINE TRAINING",44);
            summary=Label("Summary",panel,new Vector2(.12f,.72f),new Vector2(.88f,.84f),"5v5 • No internet or persistent rewards",26);
            choice=Label("Selected hero",panel,new Vector2(.1f,.64f),new Vector2(.9f,.72f),"",27);
            heroGrid=Rect("Heroes",panel,new Vector2(.07f,.38f),new Vector2(.93f,.62f));
            for(int i=0;i<HeroKitCatalog.All.Count;i++){
                var kit=HeroKitCatalog.All[i];int col=i%5,row=i/5;
                float x=col/5f,y=1-(row+1)/3f;
                ButtonAt(kit.Id,heroGrid,new Vector2(x+.008f,y+.02f),new Vector2(x+.192f,y+.31f),kit.Name,()=>Select(kit.Id));
            }
            settingsText=Label("Loadout",panel,new Vector2(.05f,.29f),new Vector2(.95f,.37f),"",22);
            for(int i=0;i<6;i++){int option=i;float x=.06f+i*.147f;ButtonAt("Setup "+i,panel,new Vector2(x,.21f),new Vector2(x+.14f,.28f),new[]{"DIFFICULTY","TACTIC","PATH","TALENT 1","TALENT 2","TALENT 3"}[i],()=>ChangeSetting(option));}
            ButtonAt("AI training",panel,new Vector2(.32f,.18f),new Vector2(.68f,.208f),"TOGGLE AI / PLAYER",()=>{autonomous=!autonomous;UpdateSettings();});
            resume=ButtonAt("Resume",panel,new Vector2(.08f,.06f),new Vector2(.46f,.17f),"RESUME",Resume);
            start=ButtonAt("Start",panel,new Vector2(.54f,.06f),new Vector2(.92f,.17f),"START NEW MATCH",StartNew);
            CreateCommands();Select(selected);UpdateSettings();Open();
        }
        private void Select(string hero){selected=HeroKitCatalog.Get(hero).Id;choice.text="Selected: "+HeroKitCatalog.Get(hero).Name;var defaults=CovenantPaths.DefaultFor(selected);path=defaults.Path;first=(int)defaults.First;second=(int)defaults.Second-3;third=(int)defaults.Third-6;UpdateSettings();}
        private void UpdateSettings(){if(settingsText)settingsText.text=$"{difficulty} | {tactic} | {path} | {(CovenantTalent)first}, {(CovenantTalent)(second+3)}, {(CovenantTalent)(third+6)} | {(autonomous?"AI VS AI":"PLAYER")}";}
        private void ChangeSetting(int option){switch(option){case 0:difficulty=(ArenaDifficulty)(((int)difficulty+1)%5);break;case 1:tactic=(ArenaTactic)(((int)tactic+1)%12);break;case 2:path=(CovenantPath)(((int)path+1)%7);break;case 3:first=(first+1)%3;break;case 4:second=(second+1)%3;break;case 5:third=(third+1)%3;break;}UpdateSettings();}
        private void Open(){
            commandOpen=false;if(commands)commands.gameObject.SetActive(false);shown=true;view.SetPaused(true);panel.gameObject.SetActive(true);
            Refresh();
        }
        private void Refresh(){
            var b=view.Battle;bool finished=b!=null&&b.Finished;
            title.text=finished?(b.Winner.HasValue?(b.Winner.Value==ArenaTeam.Lux?"VICTORY":"DEFEAT"):"DRAW"):"OFFLINE TRAINING";
            summary.text=finished?$"K/D/A {b.Player.Kills}/{b.Player.Deaths}/{b.Player.Assists} • Damage {b.Player.DamageDealt:0} • Taken {b.Player.DamageTaken:0} • No permanent rewards":"5v5 • Full faction elimination • No permanent rewards";
            resume.interactable=b!=null&&!finished&&b.Time>0;
        }
        private void Resume(){if(view.Battle==null||view.Battle.Finished)return;Close();}
        private void StartNew(){var loadout=new CovenantLoadout(path,(CovenantTalent)first,(CovenantTalent)(second+3),(CovenantTalent)(third+6));view.StartMatch(selected,seed++,difficulty,loadout,tactic,autonomous);lastFinished=false;Close();}
        private void Close(){shown=false;panel.gameObject.SetActive(false);view.SetPaused(false);}
        private void CreateCommands(){
            commands=Rect("Command panel",canvas,Vector2.zero,Vector2.one);
            commands.gameObject.AddComponent<Image>().color=Navy;
            Label("Command title",commands,new Vector2(.08f,.9f),new Vector2(.85f,.98f),"MATCH ORDERS / SHOP",32);
            ButtonAt("Back",commands,new Vector2(.85f,.9f),new Vector2(.98f,.98f),"BACK",CloseCommands);
            commandStatus=Label("Order result",commands,new Vector2(.05f,.83f),new Vector2(.95f,.9f),"",22);
            shop=new Button[GearIds.Length];
            for(int n=0;n<GearIds.Length;n++){string gear=GearIds[n];int col=n%4,row=n/4;float x=.05f+col*.225f,y=.74f-row*.075f;
                shop[n]=ButtonAt("Shop "+gear,commands,new Vector2(x,y),new Vector2(x+.22f,y+.068f),gear,()=>ApplyGear(gear));}
            string[] names={"AUTO","WOOD","STONE","FOOD","CRYSTAL","GOLD"};
            for(int n=0;n<names.Length;n++){int opt=n;float x=.05f+n*.15f;ButtonAt("Gather "+names[n],commands,new Vector2(x,.45f),new Vector2(x+.145f,.52f),names[n],()=>RunOrder(b=>b.OrderPlayerResource("lira",opt==0?(VillageResourceKind?)null:(VillageResourceKind)(opt-1))));}
            string[] orders={"RETURN","HOLD","GATHER","CANCEL BUILD"};
            for(int n=0;n<orders.Length;n++){int opt=n;float x=.05f+n*.225f;ButtonAt(orders[n],commands,new Vector2(x,.36f),new Vector2(x+.22f,.43f),orders[n],()=>RunOrder(b=>opt==3?b.CancelPlayerConstruction():b.OrderPlayerWorker("lira",opt==0?VillageWorkerOrder.Return:opt==1?VillageWorkerOrder.Hold:VillageWorkerOrder.Gather)));}
            var kinds=new[]{VillageBuildOrder.Depot,VillageBuildOrder.GuardPost,VillageBuildOrder.Farm,VillageBuildOrder.Barracks};
            for(int n=0;n<kinds.Length;n++){var kind=kinds[n];float x=.05f+n*.225f;ButtonAt("Build "+kind,commands,new Vector2(x,.26f),new Vector2(x+.22f,.33f),kind.ToString().ToUpperInvariant(),()=>RunOrder(b=>b.OrderPlayerConstruction(kind,b.Player.Position)));}
            ButtonAt("Repair nearest",commands,new Vector2(.05f,.16f),new Vector2(.49f,.23f),"REPAIR NEAREST DAMAGED",()=>RunOrder(b=>{var target=b.Units.Where(u=>u.Team==b.Player.Team&&u.Kind==BattleTargetKind.Structure&&!u.Temporary&&u.State.Alive&&u.State.Health<u.State.MaxHealth).OrderBy(u=>Vector2.Distance(u.Position,b.Player.Position)).ThenBy(u=>u.Id).FirstOrDefault();return target!=null&&b.OrderPlayerRepair(target.Id);}));
            Label("Hint",commands,new Vector2(.05f,.04f),new Vector2(.95f,.14f),"Construction uses your hero's current ground position. Move to open friendly ground first. Tap owned shop item to sell; new item to buy.",20);
            commands.gameObject.SetActive(false);
        }
        private void OpenCommands(){if(shown||commandOpen||view.Paused||view.Battle==null||view.Battle.Finished||view.Battle.AutonomousTraining)return;commandOpen=true;view.SetPaused(true);commands.gameObject.SetActive(true);commandStatus.text="Choose an order. The match is paused.";RefreshCommands();}
        private void CloseCommands(){if(!commandOpen)return;commandOpen=false;commands.gameObject.SetActive(false);if(view.Battle!=null&&!view.Battle.Finished)view.SetPaused(false);}
        private void RunOrder(Func<OfflineBattle,bool> action){var b=view.Battle;if(!commandOpen||b==null||b.Finished||b.AutonomousTraining)return;bool ok=action(b);commandStatus.text=ok?"Order accepted.":"Unavailable: check worker, resources, position or existing order.";RefreshCommands();}
        private void ApplyGear(string gear)=>RunOrder(b=>b.Player.Gear.Contains(gear)?b.SellPlayer(gear):b.BuyPlayer(gear));
        private void RefreshCommands(){
            var b=view.Battle;if(b==null)return;var p=b.Player;var v=b.GetVillage(p.Team);
            bankText.text=$"W {v.Wood:0}  S {v.Stone:0}  F {v.Food:0}  C {v.Crystal:0}  G {v.Gold:0}";
            if(!commandOpen)return;
            bool atBase=Vector2.Distance(p.Position,p.Spawn)<=12&&b.Units.Any(u=>u.Team==p.Team&&u.Core&&u.State.Alive);
            for(int n=0;n<shop.Length;n++){string gear=GearIds[n];bool owned=p.Gear.Contains(gear);int price=OfflineMatchRules.ShopPrice(gear);
                shop[n].interactable=p.State.Alive&&atBase&&(owned||p.Gold>=price&&p.Gear.Count<6);
                shop[n].GetComponentInChildren<Text>().text=gear.ToUpperInvariant()+(owned?" SELL "+(int)(price*.6f):" "+price);}
        }
        private void Update(){
            RefreshCommands();bool finished=view.Battle!=null&&view.Battle.Finished;
            if((finished&&!lastFinished)||(!shown&&!commandOpen&&view.Paused))Open();
            lastFinished=finished;
        }
        private void OnDestroy(){if(ownedEventSystem)Destroy(ownedEventSystem);}
    }
}
