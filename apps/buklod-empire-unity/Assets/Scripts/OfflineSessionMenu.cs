using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
namespace Buklod.Empire {
    // All commands target the current offline session; no account or reward mutation.
    [RequireComponent(typeof(BattleView))]
    public sealed class OfflineSessionMenu:MonoBehaviour {
        private BattleView view;private RectTransform canvas,panel,body;
        private Text title,summary,feedback;private Font font;private GameObject ownedEventSystem;
        private string selected;private bool shown,lastFinished;private int page,seed=1;
        private Image panelBackground;private float resultRevealAt=-1;private bool showResult;
        private ArenaDifficulty difficulty=ArenaDifficulty.Normal;
        private ArenaTactic tactic=ArenaTactic.Renew;
        private CovenantPath path=CovenantPath.Valor;
        private CovenantTalent first=CovenantTalent.Fortitude,second=CovenantTalent.Resolve,third=CovenantTalent.Sustenance;
        private bool autoTraining,enableCovenant=true;
        private static readonly string[] GearIds={"blade","armor","boots","sealbreaker","withering_thorn","precision","fervor","renewal","wisdom","aegis","vitality","giantbane"};
        private static readonly Color Navy=new Color(.055f,.09f,.13f,.98f);
        private RectTransform Rect(string name,Transform parent,Vector2 min,Vector2 max){
            var go=new GameObject(name,typeof(RectTransform));var r=go.GetComponent<RectTransform>();r.SetParent(parent,false);r.anchorMin=min;r.anchorMax=max;r.offsetMin=r.offsetMax=Vector2.zero;return r;
        }
        private Text Label(string name,Transform parent,Vector2 min,Vector2 max,string value,int size){
            var r=Rect(name,parent,min,max);var t=r.gameObject.AddComponent<Text>();t.font=font;t.text=value;t.fontSize=size;t.color=Color.white;t.alignment=TextAnchor.MiddleCenter;t.resizeTextForBestFit=true;t.resizeTextMinSize=12;t.resizeTextMaxSize=size;t.raycastTarget=false;return t;
        }
        private Button ButtonAt(string name,Transform parent,Vector2 min,Vector2 max,string value,Action action){
            var r=Rect(name,parent,min,max);var image=r.gameObject.AddComponent<Image>();image.color=new Color(.15f,.31f,.32f,1);var b=r.gameObject.AddComponent<Button>();b.targetGraphic=image;b.onClick.AddListener(()=>action());Label("Label",r,Vector2.zero,Vector2.one,value,23);return b;
        }
        private void Cell(int i,int cols,int rows,string text,Action action,bool enabled=true){
            float x=(i%cols)/(float)cols,y=1-(i/cols+1)/(float)rows;
            var btn=ButtonAt(text,body,new Vector2(x+.008f,y+.015f),new Vector2(x+1f/cols-.008f,y+1f/rows-.015f),text,action);btn.interactable=enabled;
        }
        private void Awake(){
            view=GetComponent<BattleView>();font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");selected=view.selectedHero;
            if(!EventSystem.current)ownedEventSystem=new GameObject("Offline UI EventSystem",typeof(EventSystem),typeof(InputSystemUIInputModule));
            canvas=Rect("Offline session UI",transform,Vector2.zero,Vector2.one);
            var c=canvas.gameObject.AddComponent<Canvas>();c.renderMode=RenderMode.ScreenSpaceOverlay;c.sortingOrder=100;
            var scaler=canvas.gameObject.AddComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1280,720);scaler.matchWidthOrHeight=.5f;
            canvas.gameObject.AddComponent<GraphicRaycaster>();
            ButtonAt("Menu",canvas,new Vector2(.89f,.91f),new Vector2(.99f,.99f),"MENU",Open);
            panel=Rect("Session panel",canvas,Vector2.zero,Vector2.one);panelBackground=panel.gameObject.AddComponent<Image>();panelBackground.color=Navy;
            title=Label("Title",panel,new Vector2(.08f,.88f),new Vector2(.92f,.98f),"OFFLINE TRAINING",36);
            summary=Label("Summary",panel,new Vector2(.04f,.80f),new Vector2(.96f,.88f),"",21);
            string[] tabs={"MATCH","LOADOUT","SHOP","VILLAGE","MARKET","FIELD"};
            for(int i=0;i<tabs.Length;i++){int tab=i;ButtonAt(tabs[i],panel,new Vector2(.035f+i*.155f,.72f),new Vector2(.18f+i*.155f,.79f),tabs[i],()=>{showResult=false;page=tab;feedback.text="";Rebuild();});}
            body=Rect("Commands",panel,new Vector2(.035f,.18f),new Vector2(.965f,.71f));
            feedback=Label("Feedback",panel,new Vector2(.03f,.10f),new Vector2(.97f,.18f),"",20);
            ButtonAt("Resume",panel,new Vector2(.06f,.015f),new Vector2(.46f,.10f),"RESUME",Resume);
            ButtonAt("Start",panel,new Vector2(.54f,.015f),new Vector2(.94f,.10f),"START NEW MATCH",StartNew);
            Open();
        }
        private void Open(){shown=true;view.SetPaused(true);panel.gameObject.SetActive(true);feedback.text="";Rebuild();}
        private bool Active=>view.Battle!=null&&!view.Battle.Finished;
        private void Reply(bool ok,string success){feedback.text=ok?success:"Not available: check eligibility, funds, distance or cooldown.";Rebuild();}
        private void Rebuild(){
            foreach(Transform child in body){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            var b=view.Battle;var p=b?.Player;bool active=Active;
            title.text=b!=null&&b.Finished?(b.Winner.HasValue?(b.Winner.Value==ArenaTeam.Lux?"VICTORY":"DEFEAT"):"DRAW"):"OFFLINE TRAINING";
            summary.text=b==null?"Free offline training":$"Lv {p.State.Level}  Gold {p.Gold}  K/D/A {p.Kills}/{p.Deaths}/{p.Assists}  •  Lux {b.RemainingUnits(ArenaTeam.Lux)} : Tenebra {b.RemainingUnits(ArenaTeam.Tenebra)}  •  No persistent rewards"+(b.Finished?" • "+b.EndReason:"");
            if(view.IsEditorReview&&showResult&&b!=null&&b.Finished){
                bool won=b.Winner==p.Team,draw=!b.Winner.HasValue;
                title.color=draw?new Color(.82f,.87f,.94f):won?new Color(1,.82f,.38f):new Color(1,.50f,.43f);
                panelBackground.color=draw?Navy:won?new Color(.065f,.14f,.12f,.98f):new Color(.15f,.065f,.085f,.98f);
                Label("Match result",body,new Vector2(.05f,.62f),new Vector2(.95f,.92f),draw?"BATTLE DRAWN":won?"LUX PREVAILS":"TENEBRA PREVAILS",42);
                Label("Match stats",body,new Vector2(.05f,.30f),new Vector2(.95f,.61f),$"{b.Time/60:0.0} min  •  Damage dealt {p.DamageDealt:0}  •  Damage taken {p.DamageTaken:0}\nKills {p.Kills}  •  Deaths {p.Deaths}  •  Assists {p.Assists}",27);
                Label("Offline scope",body,new Vector2(.05f,.07f),new Vector2(.95f,.28f),"Training result only — no persistent rewards",21);
                return;
            }
            title.color=Color.white;panelBackground.color=Navy;title.rectTransform.localScale=Vector3.one;
            if(page==0){
                for(int i=0;i<HeroKitCatalog.All.Count;i++){var kit=HeroKitCatalog.All[i];Cell(i,5,3,(selected==kit.Id?"✓ ":"")+kit.Name,()=>{selected=kit.Id;Rebuild();});}
                Cell(13,5,3,"AI: "+difficulty,()=>{difficulty=(ArenaDifficulty)(((int)difficulty+1)%5);Rebuild();});
                Cell(14,5,3,autoTraining?"AI vs AI":"Play hero",()=>{autoTraining=!autoTraining;Rebuild();});
            }else if(page==1){
                Cell(0,3,3,"Tactic: "+tactic,()=>{tactic=(ArenaTactic)(((int)tactic+1)%12);Rebuild();});
                Cell(1,3,3,"Path: "+path,()=>{path=(CovenantPath)(((int)path+1)%7);Rebuild();});
                Cell(2,3,3,"Tier 1: "+first,()=>{first=(CovenantTalent)(((int)first+1)%3);Rebuild();});
                Cell(3,3,3,"Tier 2: "+second,()=>{second=(CovenantTalent)(3+((int)second-3+1)%3);Rebuild();});
                Cell(4,3,3,"Tier 3: "+third,()=>{third=(CovenantTalent)(6+((int)third-6+1)%3);Rebuild();});
                Cell(5,3,3,enableCovenant?"Talents ON":"Talents OFF",()=>{enableCovenant=!enableCovenant;Rebuild();});
                Cell(6,3,3,"Recommended talents",()=>{var c=CovenantPaths.DefaultFor(selected);path=c.Path;first=c.First;second=c.Second;third=c.Third;Rebuild();});
                Cell(7,3,3,"Seed: "+seed,()=>{seed=seed==9999?1:seed+1;Rebuild();});
                Cell(8,3,3,"For next match",()=>{},false);
            }else if(page==2&&b!=null){
                for(int i=0;i<GearIds.Length;i++){string id=GearIds[i];bool owned=p.Gear.Contains(id);int price=OfflineMatchRules.ShopPrice(id);
                    Cell(i,4,3,(owned?"SELL ":"BUY ")+id.Replace('_',' ')+" "+(owned?(int)(price*.6f):price),()=>Reply(owned?b.SellPlayer(id):b.BuyPlayer(id),owned?"Sold":"Purchased"),active&&b.CanShopPlayer&&(owned||p.Gear.Count<6&&p.Gold>=price));}
                summary.text+="  •  Shop "+(b.CanShopPlayer?"available":"requires surviving base & range")+"  •  "+p.Gear.Count+"/6 slots";
            }else if(page==3&&b!=null){
                var bank=b.GetVillage(p.Team);var worker=b.Units.FirstOrDefault(u=>u.Team==p.Team&&u.Villager?.Job.Effect==VillageEffect.Gather);string id=worker?.Villager.Job.Id;
                summary.text=$"Wood {bank.Wood:0}  Stone {bank.Stone:0}  Food {bank.Food:0}  Crystal {bank.Crystal:0}  Gold {bank.Gold:0}  •  Cargo {(worker?.Cargo??0):0}  •  Paid troops {b.PaidTroops(p.Team)}/{b.PaidTroopCapacity(p.Team)}";
                bool can=active&&b.Time<OfflineMatchRules.MatchLimit;bool working=can&&worker!=null&&worker.State.Alive;
                Cell(0,5,4,"Auto gather",()=>Reply(b.OrderPlayerResource(id,null),"Auto gathering"),working);
                int i=1;foreach(VillageResourceKind kind in Enum.GetValues(typeof(VillageResourceKind))){var k=kind;Cell(i++,5,4,"Gather "+k,()=>Reply(b.OrderPlayerResource(id,k),"Worker assigned to "+k),working);}
                Cell(6,5,4,"Return cargo",()=>Reply(b.OrderPlayerWorker(id,VillageWorkerOrder.Return),"Return ordered"),working);
                Cell(7,5,4,"Hold worker",()=>Reply(b.OrderPlayerWorker(id,VillageWorkerOrder.Hold),"Worker held"),working);
                int j=8;foreach(var kind in new[]{VillageBuildOrder.Depot,VillageBuildOrder.GuardPost,VillageBuildOrder.Farm,VillageBuildOrder.Barracks,VillageBuildOrder.Market,VillageBuildOrder.House}){var k=kind;Cell(j++,5,4,"Build "+k,()=>Reply(b.OrderPlayerConstructionNearBase(k),"Construction queued"),can&&!b.HasConstructionOrder(p.Team));}
                Cell(14,5,4,"Repair lowest HP",()=>Reply(b.OrderPlayerRepairMostDamaged(),"Repair queued"),can&&!b.HasConstructionOrder(p.Team));
                Cell(15,5,4,"Cancel construction",()=>Reply(b.CancelPlayerConstruction(),"Cancelled"),can&&b.HasConstructionOrder(p.Team));
                var builder=b.Units.FirstOrDefault(u=>u.Team==p.Team&&u.Villager?.Job.Effect==VillageEffect.Build);
                Cell(16,5,4,builder?.Construction!=null?builder.Construction.Kind+" "+builder.Construction.Progress.ToString("0.0")+"s":"Builder idle",()=>{},false);
            }else if(page==4&&b!=null){
                var bank=b.GetVillage(p.Team);summary.text=$"Village gold {bank.Gold:0}  •  Buy 10 units / 15 gold  •  Sell 10 units / 6 gold  •  Living market required";
                int i=0;foreach(var kind in new[]{VillageResourceKind.Wood,VillageResourceKind.Stone,VillageResourceKind.Food,VillageResourceKind.Crystal}){var k=kind;Cell(i++,4,2,"Buy "+k,()=>Reply(b.TradePlayerResource(k,true),"Trade complete"),active);Cell(i++,4,2,"Sell "+k,()=>Reply(b.TradePlayerResource(k,false),"Trade complete"),active);}
            }else if(page==5&&b!=null){
                summary.text=$"Damage {p.DamageDealt:0} dealt / {p.DamageTaken:0} taken • Relics {p.Relics.Count} • Nearest visible field targets";
                int i=0;
                foreach(var u in b.Units.Where(u=>u.Team!=p.Team&&u.State.Alive&&b.IsVisibleTo(p.Team,u)&&Vector2.Distance(p.Position,u.Position)<=p.State.Kit.BasicRange).OrderBy(u=>Vector2.Distance(p.Position,u.Position)).Take(5)){var target=u;Cell(i++,4,4,"Attack "+(u.State.Kit?.Name??u.Kind.ToString()),()=>{Close();b.PlayerAttackUnit(target.Id);},active);}
                foreach(var camp in b.Camps.Where(c=>c.Alive&&Vector2.Distance(p.Position,c.Position)<=p.State.Kit.BasicRange).OrderBy(c=>Vector2.Distance(p.Position,c.Position)).Take(3)){var target=camp;Cell(i++,4,4,"Attack "+camp.Kind,()=>{Close();b.AttackNeutralPlayer(target.Id);},active);}
                foreach(var drop in b.Drops.Where(x=>Vector2.Distance(p.Position,x.Position)<=ArenaPickupCatalog.Radius).Take(4)){var target=drop;Cell(i++,4,4,"Pick "+drop.Item.Name,()=>Reply(b.CollectPlayerPickup(target.Id),"Picked up"),active);}
                foreach(var drop in b.RelicDrops.Where(x=>Vector2.Distance(p.Position,x.Position)<=ArenaRelicCatalog.Radius).Take(4)){var target=drop;Cell(i++,4,4,"Relic "+drop.Item.Name,()=>Reply(b.CollectPlayerRelic(target.Id),"Relic acquired"),active);}
                if(i==0)Cell(0,4,4,"No nearby target",()=>{},false);
            }
        }
        private void Resume(){if(Active)Close();}
        private void StartNew(){
            CovenantLoadout? loadout=enableCovenant?new CovenantLoadout(path,first,second,third):(CovenantLoadout?)null;
            view.StartMatch(selected,difficulty,tactic,loadout,autoTraining,seed);lastFinished=false;showResult=false;resultRevealAt=-1;title.rectTransform.localScale=Vector3.one;Close();
        }
        private void Close(){shown=false;panel.gameObject.SetActive(false);view.SetPaused(false);}
        private void Update(){
            bool finished=view.Battle!=null&&view.Battle.Finished;
            if(finished&&!lastFinished&&view.IsEditorReview){showResult=true;resultRevealAt=Time.unscaledTime;}
            if((finished&&!lastFinished)||(!shown&&view.Paused))Open();lastFinished=finished;
            if(shown&&finished&&showResult&&resultRevealAt>=0){
                float t=Mathf.Clamp01((Time.unscaledTime-resultRevealAt)/.65f);
                title.rectTransform.localScale=Vector3.one*Mathf.Lerp(.82f,1,1-Mathf.Pow(1-t,3));
                if(t>=1)resultRevealAt=-1;
            }
        }
        private void OnDestroy(){if(ownedEventSystem)Destroy(ownedEventSystem);}
    }
}
