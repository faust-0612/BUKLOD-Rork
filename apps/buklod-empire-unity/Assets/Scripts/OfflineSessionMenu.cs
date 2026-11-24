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
        private RectTransform canvas,panel,heroGrid,commands,armyPanel;
        private Text armyFeedback;
        private ArmyFormation armyFormation;
        private ArenaLane armyLane=ArenaLane.Mid;
        private Text treasury,commandFeedback,configuration;
        private bool commandOpen;
        private int shopPage;
        private VillageResourceKind marketResource=VillageResourceKind.Wood;
        private string selectedWorker;
        private int selectedTerritory=1;
        private VillageTechnology selectedTech;
        private Text marketStatus;
        private ArenaDifficulty difficulty=ArenaDifficulty.Normal;
        private ArenaTactic tactic=ArenaTactic.Renew;
        private CovenantPath path=CovenantPath.Valor;
        private CovenantTalent first=CovenantTalent.Fortitude,second=CovenantTalent.Resolve,third=CovenantTalent.Precision;
        private Text title,summary,choice;
        private Button resume,start;
        private Button[] shop;
        private Text shopStatus;
        private static readonly string[] GearIds={"blade","armor","boots","sealbreaker","withering_thorn","precision","fervor","renewal","wisdom","aegis","vitality","giantbane"};
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
            shop=new Button[3];
            for(int i=0;i<shop.Length;i++){
                int slot=i;float y=.83f-i*.075f;
                shop[i]=ButtonAt("Shop "+i,canvas,new Vector2(.83f,y),new Vector2(.99f,y+.066f),"",()=>TradeGear(GearIds[shopPage*3+slot]));
            }
            shopStatus=Label("Shop status",canvas,new Vector2(.65f,.57f),new Vector2(.99f,.625f),"BASE SHOP",20);
            ButtonAt("Shop page",canvas,new Vector2(.66f,.67f),new Vector2(.82f,.745f),"SHOP NEXT",()=>{shopPage=(shopPage+1)%4;RefreshShop();});
            ButtonAt("Village",canvas,new Vector2(.66f,.75f),new Vector2(.82f,.825f),"VILLAGE",OpenCommands);
            ButtonAt("Army",canvas,new Vector2(.48f,.75f),new Vector2(.65f,.825f),"ARMY",OpenArmy);
            ButtonAt("Recall",canvas,new Vector2(.45f,.08f),new Vector2(.57f,.15f),"RECALL",()=>LiveAction(b=>b.RecallPlayer()));
            ButtonAt("Tactic",canvas,new Vector2(.57f,.08f),new Vector2(.70f,.15f),"TACTIC",()=>LiveAction(b=>b.UsePlayerTactic(Vector2.zero)));
            treasury=Label("Treasury",canvas,new Vector2(.23f,.86f),new Vector2(.81f,.91f),"",19);
            panel=Rect("Session panel",canvas,Vector2.zero,Vector2.one);
            panel.gameObject.AddComponent<Image>().color=Navy;
            title=Label("Title",panel,new Vector2(.1f,.84f),new Vector2(.9f,.96f),"OFFLINE TRAINING",44);
            summary=Label("Summary",panel,new Vector2(.12f,.72f),new Vector2(.88f,.84f),"5v5 • No internet or persistent rewards",26);
            choice=Label("Selected hero",panel,new Vector2(.1f,.64f),new Vector2(.9f,.72f),"",27);
            heroGrid=Rect("Heroes",panel,new Vector2(.07f,.31f),new Vector2(.93f,.62f));
            for(int i=0;i<HeroKitCatalog.All.Count;i++){
                var kit=HeroKitCatalog.All[i];int col=i%5,row=i/5;
                float x=col/5f,y=1-(row+1)/3f;
                ButtonAt(kit.Id,heroGrid,new Vector2(x+.008f,y+.02f),new Vector2(x+.192f,y+.31f),kit.Name,()=>Select(kit.Id));
            }
            resume=ButtonAt("Resume",panel,new Vector2(.08f,.06f),new Vector2(.46f,.17f),"RESUME",Resume);
            start=ButtonAt("Start",panel,new Vector2(.54f,.06f),new Vector2(.92f,.17f),"START NEW MATCH",StartNew);
            configuration=Label("Setup",panel,new Vector2(.07f,.255f),new Vector2(.93f,.31f),"",22);
            string[] setup={"DIFFICULTY","TACTIC","PATH","TALENT I","TALENT II","TALENT III"};
            for(int i=0;i<setup.Length;i++){int index=i;float x=.07f+i*.145f;ButtonAt(setup[i],panel,new Vector2(x,.18f),new Vector2(x+.137f,.25f),setup[i],()=>CycleSetup(index));}
            CreateCommands();CreateArmy();RefreshConfiguration();Select(selected);Open();
        }
        private void Select(string hero){selected=HeroKitCatalog.Get(hero).Id;choice.text="Selected: "+HeroKitCatalog.Get(hero).Name;}
        private void Open(){
            commandOpen=false;if(commands)commands.gameObject.SetActive(false);if(armyPanel)armyPanel.gameObject.SetActive(false);
            shown=true;view.SetPaused(true);panel.gameObject.SetActive(true);
            Refresh();
        }
        private void Refresh(){
            var b=view.Battle;bool finished=b!=null&&b.Finished;
            title.text=finished?(b.Winner.HasValue?(b.Winner.Value==ArenaTeam.Lux?"VICTORY":"DEFEAT"):"DRAW"):"OFFLINE TRAINING";
            summary.text=finished?$"{b.EndReason} • K/D/A {b.Player.Kills}/{b.Player.Deaths}/{b.Player.Assists} • Damage {b.Player.DamageDealt:0} • No permanent rewards":"5v5 • No internet or persistent rewards";
            resume.interactable=b!=null&&!finished&&b.Time>0;
        }
        private void Resume(){if(view.Battle==null||view.Battle.Finished)return;Close();}
        private void StartNew(){view.StartConfiguredMatch(selected,difficulty,new CovenantLoadout(path,first,second,third),tactic);lastFinished=false;Close();}
        private void Close(){shown=false;panel.gameObject.SetActive(false);view.SetPaused(false);}
        private void CycleSetup(int index){
            switch(index){
                case 0:difficulty=(ArenaDifficulty)(((int)difficulty+1)%5);break;
                case 1:tactic=(ArenaTactic)(((int)tactic+1)%Enum.GetValues(typeof(ArenaTactic)).Length);break;
                case 2:path=(CovenantPath)(((int)path+1)%7);break;
                case 3:first=(CovenantTalent)(((int)first+1)%3);break;
                case 4:second=(CovenantTalent)(3+((int)second-3+1)%3);break;
                case 5:third=(CovenantTalent)(6+((int)third-6+1)%3);break;
            }RefreshConfiguration();
        }
        private void RefreshConfiguration(){configuration.text=$"{difficulty} • {tactic} • {path} • {first} / {second} / {third}";}
        private bool LiveAction(Func<OfflineBattle,bool> action)=>!shown&&!commandOpen&&!view.Paused&&view.Battle!=null&&!view.Battle.Finished&&action(view.Battle);
        private void TradeGear(string gear){LiveAction(b=>b.Player.Gear.Contains(gear)?b.SellPlayer(gear):b.BuyPlayer(gear));}
        private void CreateCommands(){
            commands=Rect("Village command panel",canvas,new Vector2(.12f,.12f),new Vector2(.88f,.9f));commands.gameObject.AddComponent<Image>().color=Navy;
            Label("Village title",commands,new Vector2(.02f,.88f),new Vector2(.8f,.98f),"VILLAGE COMMAND",32);
            ButtonAt("Close village",commands,new Vector2(.81f,.89f),new Vector2(.98f,.98f),"CLOSE",CloseCommands);
            commandFeedback=Label("Command feedback",commands,new Vector2(.03f,.75f),new Vector2(.97f,.87f),"",24);
            string[] labels={"AUTO","WOOD","STONE","FOOD","CRYSTAL","GOLD","RETURN","HOLD","DEPOT","GUARD POST","FARM","BARRACKS","REPAIR NEAREST","CANCEL BUILD","MARKET TYPE","BUY LOT","SELL LOT","HOUSE","RECRUIT","CANCEL RECRUIT","NEXT WORKER","NEXT TERRITORY","GATHER SITE","TECH TYPE","RESEARCH","CANCEL TECH","CARAVAN MODE","CONVOY STATUS"};
            for(int i=0;i<labels.Length;i++){int action=i;int col=i%4,row=i/4;float x=.03f+col*.235f,y=.65f-row*.095f;ButtonAt(labels[i],commands,new Vector2(x,y),new Vector2(x+.22f,y+.083f),labels[i],()=>VillageCommand(action));}
            marketStatus=Label("Market quote",commands,new Vector2(.27f,.01f),new Vector2(.97f,.06f),"",18);
            RefreshMarketQuote();
            commands.gameObject.SetActive(false);
        }
        private void CreateArmy(){
            armyPanel=Rect("Army command panel",canvas,new Vector2(.12f,.12f),new Vector2(.88f,.9f));armyPanel.gameObject.AddComponent<Image>().color=Navy;
            Label("Army title",armyPanel,new Vector2(.02f,.88f),new Vector2(.8f,.98f),"ARMY COMMAND",32);
            ButtonAt("Close army",armyPanel,new Vector2(.81f,.89f),new Vector2(.98f,.98f),"CLOSE",CloseCommands);
            armyFeedback=Label("Army order status",armyPanel,new Vector2(.03f,.67f),new Vector2(.97f,.85f),"",24);
            var orders=new[]{ArmyOrder.Automatic,ArmyOrder.Rally,ArmyOrder.PushLane,ArmyOrder.Defend,ArmyOrder.Capture,ArmyOrder.Escort};
            for(int i=0;i<orders.Length;i++){var order=orders[i];float x=.04f+(i%3)*.31f,y=.48f-(i/3)*.18f;ButtonAt(order.ToString(),armyPanel,new Vector2(x,y),new Vector2(x+.29f,y+.15f),order.ToString().ToUpperInvariant(),()=>ApplyArmy(order));}
            ButtonAt("Formation",armyPanel,new Vector2(.04f,.08f),new Vector2(.33f,.23f),"FORMATION",()=>{armyFormation=(ArmyFormation)(((int)armyFormation+1)%4);ShowArmy();});
            ButtonAt("Lane",armyPanel,new Vector2(.35f,.08f),new Vector2(.64f,.23f),"LANE",()=>{armyLane=(ArenaLane)(((int)armyLane+1)%3);ShowArmy();});
            ButtonAt("Target site",armyPanel,new Vector2(.66f,.08f),new Vector2(.95f,.23f),"TERRITORY",()=>{selectedTerritory=selectedTerritory%view.Battle.Territories.Count+1;ShowArmy();});
            armyPanel.gameObject.SetActive(false);
        }
        private void OpenArmy(){if(shown||commandOpen||view.Paused||view.Battle==null||view.Battle.Finished)return;commandOpen=true;view.SetPaused(true);armyPanel.gameObject.SetActive(true);ShowArmy();}
        private void ShowArmy(){var b=view.Battle;var active=b.GetArmyCommand(b.Player.Team);armyFeedback.text=$"{armyFormation} • {armyLane} • {b.Territories[selectedTerritory-1].Name} | Active: {active.Order} ({Mathf.Max(0,active.ExpiresAt-b.Time):0}s)";}
        private void ApplyArmy(ArmyOrder order){var b=view.Battle;if(!commandOpen||b==null||b.Finished)return;bool accepted=b.OrderPlayerArmy(order,armyFormation,armyLane,selectedTerritory);ShowArmy();armyFeedback.text+=" | "+(accepted?"Accepted":"Unavailable: check cooldown, hero or convoy.");}
        private void OpenCommands(){if(shown||commandOpen||view.Battle==null||view.Battle.Finished||view.Paused)return;commandOpen=true;view.SetPaused(true);commands.gameObject.SetActive(true);ShowTerritory(view.Battle);}
        private void CloseCommands(){commandOpen=false;commands.gameObject.SetActive(false);armyPanel.gameObject.SetActive(false);if(!shown&&view.Battle!=null&&!view.Battle.Finished)view.SetPaused(false);}
        private void RefreshMarketQuote(){marketStatus.text=$"{marketResource} x10: buy {OfflineMatchRules.MarketGold(marketResource,true)} / sell {OfflineMatchRules.MarketGold(marketResource,false)} team gold";}
        private void ShowTerritory(OfflineBattle b){var site=b.Territories[selectedTerritory-1];var delta=site.Position-b.Player.Position;commandFeedback.text=$"{site.Name} • {site.Owner?.ToString()??"Neutral"} • {(site.Contested?"Contested":site.Progress.ToString("0.0")+"/8s")} • delta {delta.x:0}, {delta.y:0}";}
        private void ShowTechnology(OfflineBattle b){
            var bank=b.GetVillage(b.Player.Team);var pending=b.PendingTechnology(b.Player.Team);
            string status=pending.HasValue?$" • {pending} {b.TechnologyProgress(b.Player.Team):P0}":"";
            commandFeedback.text=bank.TryTechnologyQuote(selectedTech,out var q)?$"{selectedTech} T{q.Tier}: W{q.Wood} S{q.Stone} F{q.Food} C{q.Crystal} G{q.Gold} • {q.Seconds:0}s"+status:$"{selectedTech} MAX"+status;
        }
        private void VillageCommand(int action){
            var b=view.Battle;if(!commandOpen||b==null||b.Finished)return;
            var workers=System.Linq.Enumerable.ToArray(System.Linq.Enumerable.Select(System.Linq.Enumerable.Where(b.Units,u=>u.Team==b.Player.Team&&u.State.Alive&&u.Villager?.Job.Effect==VillageEffect.Gather),u=>u.Villager.Job.Id));
            if(Array.IndexOf(workers,selectedWorker)<0)selectedWorker=workers.Length>0?workers[0]:null;
            string worker=selectedWorker;bool ok=false;
            switch(action){
                case 0:ok=b.OrderPlayerResource(worker,null);break;
                case 1:ok=b.OrderPlayerResource(worker,VillageResourceKind.Wood);break;
                case 2:ok=b.OrderPlayerResource(worker,VillageResourceKind.Stone);break;
                case 3:ok=b.OrderPlayerResource(worker,VillageResourceKind.Food);break;
                case 4:ok=b.OrderPlayerResource(worker,VillageResourceKind.Crystal);break;
                case 5:ok=b.OrderPlayerResource(worker,VillageResourceKind.Gold);break;
                case 6:ok=b.OrderPlayerWorker(worker,VillageWorkerOrder.Return);break;
                case 7:ok=b.OrderPlayerWorker(worker,VillageWorkerOrder.Hold);break;
                case 8:ok=b.OrderPlayerConstruction(VillageBuildOrder.Depot,b.Player.Position);break;
                case 9:ok=b.OrderPlayerConstruction(VillageBuildOrder.GuardPost,b.Player.Position);break;
                case 10:ok=b.OrderPlayerConstruction(VillageBuildOrder.Farm,b.Player.Position);break;
                case 11:ok=b.OrderPlayerConstruction(VillageBuildOrder.Barracks,b.Player.Position);break;
                case 12:ok=b.OrderPlayerRepairNearest();break;
                case 13:ok=b.CancelPlayerConstruction();break;
                case 14:marketResource=(VillageResourceKind)(((int)marketResource+1)%4);RefreshMarketQuote();return;
                case 15:ok=b.TradePlayerResource(marketResource,true);break;
                case 16:ok=b.TradePlayerResource(marketResource,false);break;
                case 17:ok=b.OrderPlayerConstruction(VillageBuildOrder.House,b.Player.Position);break;
                case 18:ok=b.RecruitPlayerVillager();break;
                case 19:ok=b.CancelPlayerRecruitment();break;
                case 20:if(workers.Length>0){selectedWorker=workers[(Array.IndexOf(workers,selectedWorker)+1)%workers.Length];commandFeedback.text="Selected worker: "+selectedWorker;}else commandFeedback.text="No living gatherers.";return;
                case 21:selectedTerritory=selectedTerritory%b.Territories.Count+1;ShowTerritory(b);return;
                case 22:ok=b.OrderPlayerTerritoryWorker(worker,selectedTerritory);break;
                case 23:selectedTech=(VillageTechnology)(((int)selectedTech+1)%5);ShowTechnology(b);return;
                case 24:ok=b.ResearchPlayerTechnology(selectedTech);break;
                case 25:ok=b.CancelPlayerTechnology();break;
                case 26:ok=b.TogglePlayerCaravan(worker);if(ok){var w=System.Linq.Enumerable.First(b.Units,u=>u.Villager?.Job.Id==worker&&u.Team==b.Player.Team);commandFeedback.text=worker+": caravan "+(w.CaravanEnabled?"enabled":"disabled");return;}break;
                case 27:commandFeedback.text=$"Convoys {b.ActiveCaravans(b.Player.Team)}/2 • Delivered {b.CaravanDeliveredResources(b.Player.Team):0.0} • Lost {b.CaravanLostResources(b.Player.Team):0.0}";return;
            }
            commandFeedback.text=ok?"Order accepted. Resume to execute.":"Unavailable: check worker, resources, position, existing order or cutoff.";
        }
        private void RefreshShop(){
            var battle=view.Battle;
            if(battle==null)return;
            var p=battle.Player;
            bool atBase=battle.CanUsePlayerShop;
            var bank=battle.GetVillage(p.Team);treasury.text=$"Wood {bank.Wood:0}  Stone {bank.Stone:0}  Food {bank.Food:0}  Crystal {bank.Crystal:0}  Gold {bank.Gold:0}  Pop {battle.VillagePopulation(p.Team)}/{battle.VillagePopulationCapacity(p.Team)}";
            shopStatus.text=atBase?$"BUY / SELL {shopPage+1}/4":"SHOP UNAVAILABLE";
            for(int i=0;i<shop.Length;i++){
                string gear=GearIds[shopPage*3+i];bool owned=p.Gear.Contains(gear);
                shop[i].interactable=!shown&&!commandOpen&&!view.Paused&&atBase&&(owned||p.Gear.Count<6&&p.Gold>=OfflineMatchRules.ShopPrice(gear));
                shop[i].GetComponentInChildren<Text>().text=owned?"SELL "+gear.ToUpperInvariant():gear.ToUpperInvariant()+" "+OfflineMatchRules.ShopPrice(gear);
            }
        }
        private void Update(){
            RefreshShop();
            bool finished=view.Battle!=null&&view.Battle.Finished;
            if((finished&&!lastFinished)||(!shown&&!commandOpen&&view.Paused))Open();
            lastFinished=finished;
        }
        private void OnDestroy(){if(ownedEventSystem)Destroy(ownedEventSystem);}
    }
}
