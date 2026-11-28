using System;
using System.Linq;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
namespace Buklod.Empire {
    // All commands target the current offline session; no account or reward mutation.
    [RequireComponent(typeof(BattleView))]
    public sealed partial class OfflineSessionMenu:MonoBehaviour {
        private BattleView view;private RectTransform canvas,panel,body;
        private Text title,summary,feedback;private Text contentStatus;private Button contentCheck,contentDownload;private Font font;private GameObject ownedEventSystem;
        private OfflinePracticeWarehouse warehouse;private VillageBuildOrder selectedBuild=VillageBuildOrder.House;private int bankPage,selectedBag=-1,selectedBank=-1,selectedSoldierId;private bool armyGroupMode=true;private Button quickLoot,quickBag,quickHealth,quickMana,quickOrders;private Text quickOrdersLabel,fieldOrderHint;private int fieldOrderMode;private float fieldOrderHintUntil;private OfflineBattle fieldOrderMatch;private Text quickLootLabel,quickHealthLabel,quickManaLabel;private float nextLootRefresh;
        private string selected;private string selectedGatherer;private bool shown,lastFinished;private int page,seed=1;
        private Image panelBackground;private RectTransform safeRoot;private Rect lastSafe;private int selectedControl;private ArenaHudLayoutEditor layoutEditor;private ArenaAuthoredUi authored;private float resultRevealAt=-1;private bool showResult,starting,heroDetail,fullBody=true,confirmRestart,matchStarted;private int evolutionPreviewLevel=1;private CanvasGroup panelGroup;private ReviewPortraits reviewPortraits;private ReviewLiveHeroPreview livePreview;
        private ArenaDifficulty difficulty=ArenaDifficulty.Normal;
        private ArenaTactic tactic=ArenaTactic.Renew;
        private CovenantPath path=CovenantPath.Valor;
        private CovenantTalent first=CovenantTalent.Fortitude,second=CovenantTalent.Resolve,third=CovenantTalent.Sustenance;
        private bool autoTraining,enableCovenant=true;
        private Button[] navigationTabs;
        private Button resumeButton,startButton;
        private CanvasGroup resultStats,resultActions;private RectTransform resultEmblem;
        private Image[] navigationMarkers;
        private Text[] navigationLabels;
        private static readonly Color NavigationAccent=new Color(.63f,.94f,.42f,1);
        private static readonly string[] GearIds={"blade","armor","boots","sealbreaker","withering_thorn","precision","fervor","renewal","wisdom","aegis","vitality","giantbane"};
        private static readonly Color Navy=new Color(.045f,.038f,.034f,.98f);
        private static readonly Color AntiqueGold=new Color(.77f,.61f,.35f,1);
        private static readonly Color MenuButton=new Color(.17f,.135f,.095f,1f);
        private RectTransform Rect(string name,Transform parent,Vector2 min,Vector2 max){
            var go=new GameObject(name,typeof(RectTransform));var r=go.GetComponent<RectTransform>();r.SetParent(parent,false);r.anchorMin=min;r.anchorMax=max;r.offsetMin=r.offsetMax=Vector2.zero;return r;
        }
        private Text Label(string name,Transform parent,Vector2 min,Vector2 max,string value,int size){
            var r=Rect(name,parent,min,max);var t=r.gameObject.AddComponent<Text>();t.font=font;t.text=value;t.fontSize=size;t.color=Color.white;t.alignment=TextAnchor.MiddleCenter;t.resizeTextForBestFit=true;t.resizeTextMinSize=12;t.resizeTextMaxSize=size;t.raycastTarget=false;return t;
        }
        private Button ButtonAt(string name,Transform parent,Vector2 min,Vector2 max,string value,Action action){
            var r=Rect(name,parent,min,max);var image=r.gameObject.AddComponent<Image>();image.color=MenuButton;
            // Preserve legibility; the old cream sprite washed out every white/green label.
            var border=r.gameObject.AddComponent<Outline>();border.effectColor=AntiqueGold;border.effectDistance=new Vector2(1,-1);
            var inset=Rect("Inset metallic edge",r,new Vector2(.025f,.065f),new Vector2(.975f,.935f));var edge=inset.gameObject.AddComponent<Image>();edge.color=new Color(.025f,.02f,.015f,.32f);edge.raycastTarget=false;
            if(authored&&authored.menuButton){image.sprite=authored.menuButton;image.type=authored.menuButton.border.sqrMagnitude>0?Image.Type.Sliced:Image.Type.Simple;image.color=new Color(.69f,.61f,.48f,1);}
            var b=r.gameObject.AddComponent<Button>();b.targetGraphic=image;
            if(view.IsEditorReview)r.gameObject.AddComponent<ReviewButtonMotion>();
            var colors=b.colors;colors.normalColor=Color.white;colors.highlightedColor=new Color(1.15f,1.15f,1.15f);colors.pressedColor=new Color(.74f,.82f,.84f);colors.selectedColor=Color.white;colors.disabledColor=new Color(.48f,.52f,.57f,.68f);b.colors=colors;
            b.onClick.AddListener(()=>{if(authored)authored.Click();action();});var label=Label("Label",r,Vector2.zero,Vector2.one,value,23);label.color=new Color(1,.92f,.76f);var shadow=label.gameObject.AddComponent<Shadow>();shadow.effectColor=new Color(0,0,0,.9f);shadow.effectDistance=new Vector2(1,-1);return b;
        }
        private void Cell(int i,int cols,int rows,string text,Action action,bool enabled=true){
            float x=(i%cols)/(float)cols,y=1-(i/cols+1)/(float)rows;
            var btn=ButtonAt(text,body,new Vector2(x+.008f,y+.015f),new Vector2(x+1f/cols-.008f,y+1f/rows-.015f),text,action);btn.interactable=enabled;
        }
        private void Awake(){
            view=GetComponent<BattleView>();reviewPortraits=view.IsEditorReview?GetComponent<ReviewPortraits>():null;font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");selected=view.selectedHero;ArenaControlSettings.ApplyFullscreen();authored=view.IsEditorReview?GetComponent<ArenaAuthoredUi>():null;
            if(!EventSystem.current)ownedEventSystem=new GameObject("Offline UI EventSystem",typeof(EventSystem),typeof(InputSystemUIInputModule));
            canvas=Rect("Offline session UI",transform,Vector2.zero,Vector2.one);
            var c=canvas.gameObject.AddComponent<Canvas>();c.renderMode=RenderMode.ScreenSpaceOverlay;c.sortingOrder=100;
            var scaler=canvas.gameObject.AddComponent<CanvasScaler>();scaler.uiScaleMode=CanvasScaler.ScaleMode.ScaleWithScreenSize;scaler.referenceResolution=new Vector2(1280,720);scaler.matchWidthOrHeight=.5f;
            canvas.gameObject.AddComponent<GraphicRaycaster>();
            safeRoot=Rect("Safe menu area",canvas,Vector2.zero,Vector2.one);ApplySafeArea();
            ButtonAt("Menu",safeRoot,new Vector2(.89f,.91f),new Vector2(.99f,.99f),"MENU",Open);
            warehouse=new OfflinePracticeWarehouse();
            quickBag=ButtonAt("Backpack shortcut",safeRoot,new Vector2(.77f,.91f),new Vector2(.88f,.99f),"BAG",()=>{if(!shown&&Active){page=6;showResult=false;Open();}});quickBag.gameObject.SetActive(false);
            quickOrders=ButtonAt("Battlefield commands",safeRoot,new Vector2(.65f,.91f),new Vector2(.76f,.99f),"ORDERS",()=>{if(!CanUseFieldOrders)return;fieldOrderMode=(fieldOrderMode+1)%4;RefreshFieldOrderText();});quickOrdersLabel=quickOrders.GetComponentInChildren<Text>();quickOrders.gameObject.SetActive(false);
            fieldOrderHint=Label("Battlefield order guidance",safeRoot,new Vector2(.22f,.765f),new Vector2(.77f,.83f),"",19);fieldOrderHint.color=new Color(1,.86f,.50f);fieldOrderHint.gameObject.SetActive(false);
            quickHealth=QuickPotion("health",new Vector2(.28f,.035f),new Vector2(.36f,.115f),out quickHealthLabel);
            quickMana=QuickPotion("mana",new Vector2(.37f,.035f),new Vector2(.45f,.115f),out quickManaLabel);
            quickLoot=ButtonAt("Collect nearby loot",safeRoot,new Vector2(.38f,.13f),new Vector2(.63f,.23f),"PICK UP",()=>{if(!shown&&!view.Paused&&view.Battle!=null&&view.Battle.TryNearbyLoot(out _,true))authored?.AcceptedAction("Relic acquired");});quickLootLabel=quickLoot.GetComponentInChildren<Text>();quickLoot.gameObject.SetActive(false);
            ButtonAt("Zoom in",safeRoot,new Vector2(.91f,.81f),new Vector2(.99f,.89f),"+",()=>ArenaControlSettings.ChangeZoom(-.1f));
            ButtonAt("Zoom out",safeRoot,new Vector2(.91f,.71f),new Vector2(.99f,.79f),"−",()=>ArenaControlSettings.ChangeZoom(.1f));
            panel=Rect("Session panel",safeRoot,Vector2.zero,Vector2.one);panelBackground=panel.gameObject.AddComponent<Image>();panelBackground.color=Navy;panelGroup=panel.gameObject.AddComponent<CanvasGroup>();
            if(authored&&authored.menuPanel){panelBackground.sprite=authored.menuPanel;panelBackground.type=authored.menuPanel.border.sqrMagnitude>0?Image.Type.Sliced:Image.Type.Simple;}
            title=Label("Title",panel,new Vector2(.08f,.88f),new Vector2(.92f,.98f),"OFFLINE TRAINING",36);
            summary=Label("Summary",panel,new Vector2(.04f,.80f),new Vector2(.96f,.88f),"",21);
            if(view.IsEditorReview){
                var scope=Label("Mode status",panel,new Vector2(.035f,.985f),new Vector2(.965f,1f),"OFFLINE PRACTICE  •  ONLINE NOT ENABLED",12);
                scope.color=new Color(.85f,.91f,.96f);
            }
            string[] tabs=view.IsEditorReview?new[]{"LOBBY","HEROES","LOADOUT","SHOP","VILLAGE","MARKET","FIELD","VAULT","SETTINGS","ARMY"}:new[]{"MATCH","LOADOUT","SHOP","VILLAGE","MARKET","FIELD","VAULT","HUD","ARMY"};
            if(view.IsEditorReview){page=-1;ReviewAudioSettings.ApplyMaster();}
            navigationTabs=new Button[tabs.Length];navigationMarkers=new Image[tabs.Length];navigationLabels=new Text[tabs.Length];
            for(int i=0;i<tabs.Length;i++){
                int tab=i==tabs.Length-1?10:view.IsEditorReview?i-1:i;float step=.93f/tabs.Length;
                var button=ButtonAt(tabs[i],panel,new Vector2(.035f+i*step,.72f),new Vector2(.035f+(i+1)*step-.01f,.79f),tabs[i],()=>{showResult=false;heroDetail=false;confirmRestart=false;page=tab;feedback.text="";Rebuild();});
                navigationTabs[i]=button;navigationLabels[i]=button.GetComponentInChildren<Text>();
                var marker=Rect("Active section",button.transform,new Vector2(.12f,.025f),new Vector2(.88f,.095f)).gameObject.AddComponent<Image>();
                marker.color=NavigationAccent;marker.raycastTarget=false;navigationMarkers[i]=marker;
            }
            body=Rect("Commands",panel,new Vector2(.035f,.18f),new Vector2(.965f,.71f));
            feedback=Label("Feedback",panel,new Vector2(.03f,.10f),new Vector2(.97f,.18f),"",20);
            resumeButton=ButtonAt("Resume",panel,new Vector2(.06f,.015f),new Vector2(.46f,.10f),"RESUME CURRENT MATCH",Resume);
            startButton=ButtonAt("Start",panel,new Vector2(.54f,.015f),new Vector2(.94f,.10f),"START NEW MATCH",StartNew);
            if(view.IsEditorReview){var startLabel=startButton.GetComponentInChildren<Text>();startLabel.color=NavigationAccent;startLabel.fontStyle=FontStyle.Bold;}
            if(view.IsEditorReview)pregame=new ReviewMatchFlow();
            Open();
        }
        private bool CanUseFieldOrders=>view&&view.Battle!=null&&!view.Battle.IsAuthoritative&&!view.Battle.AutonomousTraining&&!view.Battle.Finished&&!shown&&!starting&&!view.Paused;
        internal static bool IsFieldOrderZone(UnityEngine.Rect area,Vector2 screen){
            if(!area.Contains(screen)||area.width<=0||area.height<=0)return false;
            float x=(screen.x-area.xMin)/area.width,y=(screen.y-area.yMin)/area.height;
            return x>=.22f&&x<=.76f&&y>=.26f&&y<=.75f;
        }
        internal bool ReserveFieldOrderTouch(Vector2 screen)=>fieldOrderMode!=0&&CanUseFieldOrders&&IsFieldOrderZone(MobileBattleInput.SafeArea,screen);
        private void RefreshFieldOrderText(){
            if(!quickOrdersLabel||!fieldOrderHint)return;
            quickOrdersLabel.text=fieldOrderMode==1?"GROUP":fieldOrderMode==2?"UNIT":fieldOrderMode==3?"BUILD":"ORDERS";
            quickOrdersLabel.color=fieldOrderMode==0?Color.white:new Color(1,.82f,.35f);
            fieldOrderHint.text=fieldOrderMode==1?"Tap ground to move formation • tap visible enemy to attack":
                fieldOrderMode==2?"Select friendly soldier • tap ground or visible enemy":
                fieldOrderMode==3?"Tap valid ground to build "+selectedBuild:"";
            fieldOrderHint.gameObject.SetActive(fieldOrderMode!=0);fieldOrderHintUntil=0;
        }
        private void FieldOrderFeedback(string text){if(!fieldOrderHint)return;fieldOrderHint.text=text;fieldOrderHint.gameObject.SetActive(true);fieldOrderHintUntil=Time.unscaledTime+2.2f;}
        internal void CompleteFieldOrderTouch(Vector2 screen){
            if(!ReserveFieldOrderTouch(screen))return;
            var battle=view.Battle;
            if(fieldOrderMode==2){
                var hit=view.FindFriendlySoldierAtScreen(screen,Mathf.Max(18,MobileBattleInput.SafeArea.height*.052f));
                if(hit!=null){selectedSoldierId=hit.Id;FieldOrderFeedback((hit.RecruitedCreature?.ToString()??hit.Role.ToString())+" selected • tap destination");return;}
            }
            if(fieldOrderMode==1||fieldOrderMode==2){var enemy=view.FindEnemyArmyTargetAtScreen(screen,Mathf.Max(18,MobileBattleInput.SafeArea.height*.045f));if(enemy!=null){bool sent=fieldOrderMode==1?battle.OrderPlayerArmyAttack(enemy.Id):selectedSoldierId>0&&battle.OrderPlayerArmyAttack(enemy.Id,selectedSoldierId);FieldOrderFeedback(sent?"Attack order accepted":"Select an eligible soldier or visible enemy");return;}}
            if(!view.TryFieldPoint(screen,out var p)){FieldOrderFeedback("No reachable battlefield point");return;}
            bool ok=fieldOrderMode==1?battle.OrderPlayerFormationMove(p):fieldOrderMode==2?battle.OrderPlayerSoldierMove(selectedSoldierId,p):battle.OrderPlayerConstruction(selectedBuild,p);
            FieldOrderFeedback(ok?(fieldOrderMode==3?"Construction queued":fieldOrderMode==1?"Army formation ordered":"Soldier destination ordered"):"Order rejected • check terrain, ownership, vision or resources");
        }
        private Button QuickPotion(string slot,Vector2 min,Vector2 max,out Text label){
            var button=ButtonAt("Quick "+slot,safeRoot,min,max,slot=="health"?"HP":"MP",()=>{
                var battle=view.Battle;if(shown||view.Paused||battle==null)return;
                if(battle.UseQuickPracticePotion(slot)&&authored)authored.AcceptedAction("Picked up",slot);
            });
            label=button.GetComponentInChildren<Text>();label.color=slot=="health"?new Color(1,.42f,.32f):new Color(.36f,.73f,1);
            button.gameObject.SetActive(false);return button;
        }
        private void RefreshQuickPotion(Button button,Text label,string slot,OfflineBattle battle,bool visible){
            if(!button)return;int count=visible?battle.CountPracticePotions(slot):0;
            button.gameObject.SetActive(visible&&count>0);if(count<=0)return;
            label.text=(slot=="health"?"HP ":"MP ")+count;button.interactable=battle.CanUseQuickPracticePotion(slot);
            var art=view.visuals.ResolveItem(slot,1);var raw=button.GetComponentInChildren<RawImage>(true);
            if(art!=null&&art.icon&&!raw){var r=Rect("Potion icon",button.transform,new Vector2(.03f,.08f),new Vector2(.48f,.92f));raw=r.gameObject.AddComponent<RawImage>();raw.raycastTarget=false;raw.texture=art.icon;label.rectTransform.anchorMin=new Vector2(.46f,0);label.rectTransform.anchorMax=Vector2.one;label.transform.SetAsLastSibling();}
        }
        private void ApplySafeArea(){lastSafe=MobileBattleInput.SafeArea;safeRoot.anchorMin=new Vector2(lastSafe.xMin/Mathf.Max(1,Screen.width),lastSafe.yMin/Mathf.Max(1,Screen.height));safeRoot.anchorMax=new Vector2(lastSafe.xMax/Mathf.Max(1,Screen.width),lastSafe.yMax/Mathf.Max(1,Screen.height));}
        private void Open(){if(starting)return;fieldOrderMode=0;RefreshFieldOrderText();panelGroup.alpha=1;shown=true;view.SetPaused(true);panel.gameObject.SetActive(true);feedback.text="";Rebuild();}
        private bool Active=>view.Battle!=null&&!view.Battle.Finished;
        private void Reply(bool ok,string success,string pickupEffect=null){if(ok&&authored)authored.AcceptedAction(success,pickupEffect);feedback.text=ok?success:"Not available: check eligibility, funds, distance or cooldown.";Rebuild();}
        private void HeroCard(int i,HeroKit kit){
            float x=(i%5)/5f,y=1-(i/5+1)/3f;
            var r=Rect(kit.Id,body,new Vector2(x+.008f,y+.015f),new Vector2(x+.192f,y+1f/3-.015f));
            var accent=BattleEffects.Accent(kit.Id);bool chosen=kit.Id==selected;
            var bg=r.gameObject.AddComponent<Image>();bg.color=Color.Lerp(Navy,accent,chosen?.31f:.12f);
            var btn=r.gameObject.AddComponent<Button>();btn.targetGraphic=bg;btn.onClick.AddListener(()=>{if(authored)authored.Click();selected=kit.Id;heroDetail=true;fullBody=true;evolutionPreviewLevel=1;var dialogue=GetComponent<ReviewHeroDialogue>();if(dialogue)feedback.text=dialogue.Select(kit.Id);Rebuild();});
            var stripe=Rect("Sacred stone accent",r,new Vector2(0,.94f),Vector2.one).gameObject.AddComponent<Image>();stripe.color=accent;stripe.raycastTarget=false;
            var portrait=reviewPortraits?reviewPortraits.Find(kit.Id):null;
            float left=portrait ? .37f : .05f;
            if(portrait){
                var holder=Rect("Portrait frame",r,new Vector2(.025f,.05f),new Vector2(.35f,.92f));
                var pic=Rect("Captured portrait",holder,Vector2.zero,Vector2.one).gameObject.AddComponent<RawImage>();
                pic.texture=portrait;pic.raycastTarget=false;
                var fit=pic.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)portrait.width/portrait.height;
            }
            var name=Label("Hero name",r,new Vector2(left,.63f),new Vector2(.95f,.94f),(chosen?"✓ ":"")+kit.Name+"\n"+kit.RoleProfile.Role,20);name.color=accent;
            for(int j=0;j<3;j++){
                if(!SkillCueCatalog.TryGet(kit.Skill((SkillSlot)j).Id,out var cue))continue;
                var symbol=Rect("Skill "+j,r,new Vector2(left+(1-left)*(.05f+j*.30f),.23f),new Vector2(left+(1-left)*(.30f+j*.30f),.61f)).gameObject.AddComponent<ReviewSkillGlyph>();
                symbol.raycastTarget=false;symbol.SetCue(cue,accent);
            }
            var stats=view.PracticeStats(kit.Id);
            Label("Combat range",r,new Vector2(left,.02f),new Vector2(.97f,.22f),stats==null?$"ATK {kit.BasicDamage:0}  •  RNG {kit.BasicRange:0.#}":$"ATK {kit.BasicDamage:0}  •  M{stats.Mastery} / {stats.completed} matches",16);
        }
        private Texture ShowcaseTexture(bool full){
            if(view.IsEditorReview){
                if(!livePreview)livePreview=gameObject.AddComponent<ReviewLiveHeroPreview>();
                var live=livePreview.Show(view,selected,full,heroDetail?evolutionPreviewLevel:1);if(live)return live;
            }
            return reviewPortraits?reviewPortraits.Find(selected,full):null;
        }
        private void HideShowcase(){if(livePreview)livePreview.Hide();}
        ReviewPalette previewPalette=ReviewPalette.Original;
        private void HeroDetails(){
            var kit=HeroKitCatalog.Get(selected);var accent=BattleEffects.Accent(selected);
            title.text=kit.Name.ToUpperInvariant()+"  •  HERO PROFILE";title.color=accent;
            SacredStoneCatalog.TryGet(selected,out var stone);
            summary.text=kit.RoleProfile.Label+" • "+(stone==null?"Next match selection":stone.Name+" • "+stone.VirtueTl);
            var left=Rect("Hero showcase",body,new Vector2(.015f,.04f),new Vector2(.44f,.98f));
            var bg=left.gameObject.AddComponent<Image>();bg.color=Color.Lerp(Navy,accent,.13f);bg.raycastTarget=false;
            var portrait=ShowcaseTexture(fullBody);
            bool paletteAvailable=portrait is RenderTexture&&livePreview&&livePreview.SetPalette(previewPalette);
            if(portrait){
                var r=Rect("Actual model capture",left,new Vector2(.04f,.21f),new Vector2(.96f,.99f));
                var image=r.gameObject.AddComponent<RawImage>();image.texture=portrait;image.raycastTarget=false;
                var fit=r.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)portrait.width/portrait.height;
            }
            ButtonAt("Portrait angle",left,new Vector2(.03f,.03f),new Vector2(.48f,.19f),fullBody?"FACE / ARMOR":"FULL BODY",()=>{fullBody=!fullBody;evolutionPreviewLevel=1;Rebuild();});
            var wingButton=ButtonAt("Locked evolution preview",left,new Vector2(.50f,.03f),new Vector2(.97f,.19f),"NEXT STAGE",()=>{evolutionPreviewLevel=ArenaProgression.NextPreviewLevel(evolutionPreviewLevel);fullBody=true;Rebuild();});
            wingButton.interactable=portrait is RenderTexture||evolutionPreviewLevel>1;
            if(paletteAvailable){
                var paletteButton=ButtonAt("Costume palette",left,new Vector2(.04f,.21f),new Vector2(.96f,.30f),"PREVIEW: "+previewPalette,()=>{previewPalette=(ReviewPalette)(((int)previewPalette+1)%3);Rebuild();});
                paletteButton.GetComponentInChildren<Text>().fontSize=16;
            }
            if(evolutionPreviewLevel>1){
                var banner=Label("Preview disclaimer",left,new Vector2(.04f,.83f),new Vector2(.96f,.99f),
                    "L"+evolutionPreviewLevel+" • "+ArenaProgression.Evolution(evolutionPreviewLevel)+"\n"+(portrait is RenderTexture?"LOCKED • CONCEPT PREVIEW":"PREVIEW UNAVAILABLE • BASE CAPTURE"),16);
                banner.color=accent;
            }
            var right=Rect("Hero profile",body,new Vector2(.46f,.04f),new Vector2(.99f,.98f));
            Label("Hero stats",right,new Vector2(0,.78f),Vector2.one,$"ATK {kit.BasicDamage:0}   RANGE {kit.BasicRange:0.#}   SPEED {kit.Speed:0.##}\nPassive: "+kit.Passive.Replace('_',' '),18);
            for(int i=0;i<3;i++){
                var spec=kit.Skill((SkillSlot)i);float y=.76f-i*.18f;
                var row=Rect("Skill "+i,right,new Vector2(0,y-.16f),new Vector2(1,y));
                var background=row.gameObject.AddComponent<Image>();background.color=new Color(.10f,.18f,.23f,.95f);background.raycastTarget=false;
                if(SkillCueCatalog.TryGet(spec.Id,out var cue)){
                    var glyph=Rect("Skill symbol",row,new Vector2(.02f,.08f),new Vector2(.16f,.92f)).gameObject.AddComponent<ReviewSkillGlyph>();glyph.raycastTarget=false;glyph.SetCue(cue,accent);
                }
                var slot=(SkillSlot)i;
                var preview=ButtonAt("Preview "+spec.Id,row,new Vector2(.19f,.05f),new Vector2(.76f,.95f),spec.Id.Replace('_',' '),()=>{
                    if(livePreview&&livePreview.PlaySkill(slot)){
                        feedback.text=ReviewSkillTrial.Evaluate(selected,slot).Summary+" • No rewards";
                        if(slot==SkillSlot.Ultimate){var voice=GetComponent<ReviewHeroDialogue>();if(voice){var line=voice.PreviewUltimate(selected);if(!string.IsNullOrEmpty(line))feedback.text=line+" • "+feedback.text;}}
                    }else feedback.text="Live animation unavailable; showing captured portrait.";
                });
                preview.GetComponentInChildren<Text>().fontSize=20;
                var cd=Label("Base cooldown",row,new Vector2(.77f,0),new Vector2(.98f,1),spec.Cooldown.ToString("0")+"s",20);cd.color=accent;
            }
            Label("Evolution scope",right,new Vector2(0,.10f),new Vector2(1,.21f),"Offline practice: local mastery only. Permanent evolution status not verified. BP eligibility and required items must be confirmed by MAIN.",16);
            ButtonAt("Back to roster",right,Vector2.zero,new Vector2(.47f,.10f),"ROSTER",()=>{heroDetail=false;Rebuild();});
            ButtonAt("Choose hero",right,new Vector2(.51f,0),new Vector2(1,.10f),"USE IN NEXT MATCH",()=>{heroDetail=false;page=-1;Rebuild();feedback.text=kit.Name+" selected for the next match.";});
        }
        private Button VaultCell(Transform parent,int index,int cols,int rows,string title,ArenaRelicDefinition item,bool selected,Action click){
            float x=(index%cols)/(float)cols,y=1-(index/cols+1)/(float)rows;
            var button=ButtonAt(title,parent,new Vector2(x+.006f,y+.01f),new Vector2(x+1f/cols-.006f,y+1f/rows-.01f),item==null?title:item.Slot.ToUpperInvariant()+"\nT"+item.Tier,click);
            var image=button.GetComponent<Image>();image.color=selected?new Color(.32f,.24f,.12f):new Color(.055f,.085f,.12f);
            var outline=button.GetComponent<Outline>();outline.effectColor=item==null?new Color(.28f,.32f,.37f):BattleFieldVisuals.TierColor(item.Tier);
            var label=button.GetComponentInChildren<Text>();label.color=item==null?new Color(.55f,.60f,.65f):BattleFieldVisuals.TierColor(item.Tier);
            if(item!=null){var art=view.visuals.ResolveItem(item.Slot,item.Tier);if(art!=null&&art.icon){var pic=Rect("Authored item icon",button.transform,new Vector2(.07f,.24f),new Vector2(.93f,.95f));var raw=pic.gameObject.AddComponent<RawImage>();raw.texture=art.icon;raw.raycastTarget=false;var fit=pic.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=1;label.rectTransform.anchorMin=new Vector2(0,0);label.rectTransform.anchorMax=new Vector2(1,.25f);label.text="T"+item.Tier;label.transform.SetAsLastSibling();}}
            return button;
        }
        private void RelicInventory(OfflineBattle battle){
            var p=battle?.Player;var bag=battle?.PracticeVault;bool baseAccess=battle!=null&&battle.CanShopPlayer&&!battle.AutonomousTraining;
            if(selectedBag>= (bag?.Count??0))selectedBag=-1;if(selectedBank>=warehouse.Items.Count)selectedBank=-1;
            title.text="INVENTORY & WAREHOUSE";title.color=AntiqueGold;
            summary.text=$"BACKPACK {bag?.Count??0}/{OfflineBattle.PracticeVaultCapacity}  •  DEVICE VAULT {warehouse.Items.Count}/{OfflinePracticeWarehouse.Capacity}  •  Offline only";
            if(!warehouse.Available)summary.text+=" • Storage unavailable; original data retained";
            var equip=Rect("Hero equipment",body,new Vector2(0,.18f),new Vector2(.24f,.96f));
            var equipBg=equip.gameObject.AddComponent<Image>();equipBg.color=new Color(.045f,.035f,.027f,.95f);equipBg.raycastTarget=false;var equipFrame=equip.gameObject.AddComponent<Outline>();equipFrame.effectColor=AntiqueGold;
            var backpack=Rect("Backpack grid",body,new Vector2(.25f,.18f),new Vector2(.62f,.90f));
            var bank=Rect("Vault grid",body,new Vector2(.63f,.18f),new Vector2(1,.90f));
            Label("Backpack title",body,new Vector2(.25f,.91f),new Vector2(.62f,1),"BACKPACK",22).color=new Color(.91f,.79f,.48f);
            Label("Vault title",body,new Vector2(.63f,.91f),new Vector2(1,1),"WAREHOUSE",22).color=new Color(.91f,.79f,.48f);
            Texture portrait=null;
            if(view.IsEditorReview&&p!=null){if(!livePreview)livePreview=gameObject.AddComponent<ReviewLiveHeroPreview>();portrait=livePreview.ShowEquipped(view,p);}
            if(!portrait&&reviewPortraits)portrait=reviewPortraits.Find(p?.State.Kit.Id??selected,true);
            if(portrait){var r=Rect("Hero portrait",equip,new Vector2(.32f,.12f),new Vector2(.68f,.96f));var image=r.gameObject.AddComponent<RawImage>();image.texture=portrait;image.raycastTarget=false;var fit=r.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)portrait.width/Mathf.Max(1,portrait.height);}
            int n=0;foreach(string slot in new[]{"weapon","shield","armor","boots","jewel"}){
                ArenaRelicDefinition item=null;if(p!=null)p.Relics.TryGetValue(slot,out item);string s=slot;
                float x=n<3?.015f:.68f,top=.92f-(n<3?n:n-3)*.29f;
                var button=ButtonAt("Equip "+slot,equip,new Vector2(x,top-.26f),new Vector2(x+.30f,top),slot.ToUpperInvariant(),()=>Reply(battle.UnequipPracticeItem(s),"Returned to backpack"));
                button.interactable=baseAccess&&item!=null;button.GetComponent<Outline>().effectColor=item==null?new Color(.3f,.32f,.37f):BattleFieldVisuals.TierColor(item.Tier);
                var art=item==null?null:view.visuals.ResolveItem(slot,item.Tier);if(art!=null&&art.icon){var pic=Rect("Equipped model render",button.transform,new Vector2(.04f,.22f),new Vector2(.96f,.96f));var image=pic.gameObject.AddComponent<RawImage>();image.texture=art.icon;image.raycastTarget=false;var fit=pic.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=1;var label=button.GetComponentInChildren<Text>();label.text="T"+item.Tier;label.rectTransform.anchorMin=Vector2.zero;label.rectTransform.anchorMax=new Vector2(1,.22f);label.transform.SetAsLastSibling();}n++;
            }
            for(int i=0;i<OfflineBattle.PracticeVaultCapacity;i++){int k=i;var item=bag!=null&&i<bag.Count?bag[i]:null;var btn=VaultCell(backpack,i,4,5,"",item,selectedBag==i,()=>{selectedBag=k;selectedBank=-1;Rebuild();});btn.interactable=item!=null;}
            for(int i=0;i<24;i++){int k=bankPage*24+i;var item=k<warehouse.Items.Count?warehouse.Items[k]:null;var btn=VaultCell(bank,i,4,6,"",item,selectedBank==k,()=>{selectedBank=k;selectedBag=-1;Rebuild();});btn.interactable=item!=null;}
            var picked=selectedBag>=0?bag[selectedBag]:selectedBank>=0?warehouse.Items[selectedBank]:null;
            string detail=picked==null?"Select item • Forge: two identical relics • Withdrawn items remain match-local":picked.Name+" • T"+picked.Tier+" • "+picked.Hero.ToUpperInvariant()+" • "+(picked.Slot=="cache"?"Open in battlefield: drops equipment and village gold":picked.Consumable?"Restore "+picked.Amount.ToString("0"):("ATK "+picked.Stats.Attack.ToString("0.#")+"  HP "+picked.Stats.Hp.ToString("0.#")+"  Shield "+picked.Stats.ShieldMax.ToString("0.#")+"  Mana "+picked.Stats.Mana.ToString("0.#")));
            var detailPanel=Rect("Item tooltip",body,new Vector2(0,.085f),new Vector2(1,.175f));var tooltipBg=detailPanel.gameObject.AddComponent<Image>();tooltipBg.color=new Color(.02f,.016f,.012f,.95f);tooltipBg.raycastTarget=false;var tooltipEdge=detailPanel.gameObject.AddComponent<Outline>();tooltipEdge.effectColor=picked==null?AntiqueGold:BattleFieldVisuals.TierColor(picked.Tier);
            if(picked!=null&&!picked.Consumable)detail+=$"  SPD +{picked.Stats.Speed*100:0.#}%  CD -{picked.Stats.Cooldown*100:0.#}%";
            Label("Item details",detailPanel,new Vector2(.02f,0),new Vector2(.98f,1),detail,20).color=picked==null?Color.white:BattleFieldVisuals.TierColor(picked.Tier);
            var use=ButtonAt("Use selected",body,new Vector2(0,0),new Vector2(.19f,.08f),picked!=null&&picked.Slot=="cache"?"OPEN":picked!=null&&picked.Consumable?"USE":"EQUIP",()=>{int k=selectedBag;selectedBag=-1;if(picked.Slot=="cache"){if(battle.OpenPracticeCache(k)){Close();}else Reply(false,"");}else Reply(battle.UsePracticeBag(k),"Item used / equipped");});use.interactable=selectedBag>=0&&(picked.Slot=="cache"?battle.CanOpenPracticeCache(selectedBag):picked.Consumable?battle!=null&&!battle.Finished&&p.State.Alive:baseAccess);
            var deposit=ButtonAt("Deposit",body,new Vector2(.20f,0),new Vector2(.39f,.08f),"DEPOSIT",()=>{int k=selectedBag;selectedBag=-1;Reply(battle.DepositPracticeItem(k,warehouse),"Saved to device vault");});deposit.interactable=baseAccess&&selectedBag>=0&&warehouse.Available;
            var withdraw=ButtonAt("Withdraw",body,new Vector2(.40f,0),new Vector2(.59f,.08f),"WITHDRAW",()=>{int k=selectedBank;selectedBank=-1;Reply(battle.WithdrawPracticeItem(k,warehouse),"Withdrawn to match backpack");});withdraw.interactable=baseAccess&&selectedBank>=0&&warehouse.Available&&picked.Hero==p.State.Kit.Id;
            var forge=ButtonAt("Forge",body,new Vector2(.60f,0),new Vector2(.79f,.08f),"FORGE +1",()=>{int k=selectedBag;selectedBag=-1;Reply(battle.ForgePracticeItem(k),"Two matching relics forged into next tier");});forge.interactable=baseAccess&&selectedBag>=0&&battle.CanForgePracticeItem(selectedBag);
            ButtonAt("Vault page",body,new Vector2(.80f,0),new Vector2(1,.08f),"PAGE "+(bankPage+1)+"/2",()=>{bankPage=1-bankPage;selectedBank=-1;Rebuild();});
        }
        private void TacticalMap(OfflineBattle battle,Transform parent,Vector2 min,Vector2 max,int selectedId,Action<Vector2> onPoint){
            var r=Rect("Tactical map",parent,min,max);var graphic=r.gameObject.AddComponent<ReviewMinimap>();graphic.Bind(view);graphic.SelectedSoldierId=selectedId;graphic.raycastTarget=true;
            var trigger=r.gameObject.AddComponent<EventTrigger>();var entry=new EventTrigger.Entry{eventID=EventTriggerType.PointerClick};
            entry.callback.AddListener(data=>{var e=data as PointerEventData;if(e==null||!RectTransformUtility.ScreenPointToLocalPointInRectangle(r,e.position,e.pressEventCamera,out var p))return;var bounds=r.rect;var uv=new Vector2(Mathf.InverseLerp(bounds.xMin+2,bounds.xMax-2,p.x),Mathf.InverseLerp(bounds.yMin+2,bounds.yMax-2,p.y));onPoint(new Vector2(uv.x*OfflineBattle.Width,uv.y*OfflineBattle.Height));});trigger.triggers.Add(entry);
        }
        private void ArmyPanel(OfflineBattle b){
            var soldiers=b.Units.Where(u=>u.PaidMinion&&u.Team==b.Player.Team&&u.State.Alive).OrderBy(u=>u.Id).ToArray();
            var chosen=soldiers.FirstOrDefault(u=>u.Id==selectedSoldierId)??soldiers.FirstOrDefault();selectedSoldierId=chosen?.Id??0;
            var contracts=b.PlayerCreatureContracts.ToArray();summary.text="ARMORY • "+soldiers.Length+" soldiers • Defeat local creatures to unlock recruitment • Tap visible map to order selected unit";
            TacticalMap(b,body,new Vector2(0,.14f),new Vector2(.43f,1),armyGroupMode?0:selectedSoldierId,p=>Reply(armyGroupMode?b.OrderPlayerFormationMove(p):b.OrderPlayerSoldierMove(selectedSoldierId,p),armyGroupMode?"Formation destination assigned":"Soldier waypoint assigned"));
            ButtonAt("Construction",body,new Vector2(0,0),new Vector2(.43f,.13f),"VILLAGE / BUILD SITE",()=>{page=11;Rebuild();});
            var commands=Rect("Army commands",body,new Vector2(.45f,0),Vector2.one);
            void ArmyCell(int i,string value,Action action,bool enabled=true){float x=(i%3)/3f,y=1-(i/3+1)/5f;var button=ButtonAt(value,commands,new Vector2(x+.008f,y+.012f),new Vector2(x+1f/3-.008f,y+.188f),value,action);button.interactable=enabled;}
            ArmyCell(0,"Creature: "+(b.PlayerCreatureContract?.ToString()??"None"),()=>{var current=Array.IndexOf(contracts,b.PlayerCreatureContract??(WildernessKind)(-1));b.OrderPlayerCreature(contracts.Length==0||current+1>=contracts.Length?(WildernessKind?)null:contracts[current+1]);Rebuild();},contracts.Length>0);
            ArmyCell(1,"Standard: "+b.PlayerMilitaryRole,()=>Reply(b.OrderPlayerMilitaryRole((MinionRole)(((int)b.PlayerMilitaryRole+1)%5)),"Standard role selected"));
            ArmyCell(2,chosen==null?"No soldier":(chosen.RecruitedCreature?.ToString()??chosen.Role.ToString())+" #"+chosen.Id,()=>{selectedSoldierId=soldiers[(Array.IndexOf(soldiers,chosen)+1)%soldiers.Length].Id;Rebuild();},chosen!=null);
            int i=3;foreach(VillageArmyOrder order in Enum.GetValues(typeof(VillageArmyOrder))){var o=order;ArmyCell(i++,"ALL: "+o,()=>Reply(b.OrderPlayerArmy(o),"Army order accepted"));}
            foreach(VillageArmyOrder order in Enum.GetValues(typeof(VillageArmyOrder))){var o=order;ArmyCell(i++,"UNIT: "+o,()=>Reply(b.OrderPlayerSoldier(selectedSoldierId,o),"Soldier order accepted"),chosen!=null);}
            ArmyCell(11,armyGroupMode?"MAP: GROUP":"MAP: SINGLE",()=>{armyGroupMode=!armyGroupMode;Rebuild();});
            ArmyCell(12,"Formation: "+b.PlayerFormation,()=>Reply(b.SetPlayerFormation((VillageFormation)(((int)b.PlayerFormation+1)%3)),"Formation selected"));
            ArmyCell(13,chosen==null?"No soldier":$"HP {chosen.State.Health:0}/{chosen.State.MaxHealth:0}",()=>{},false);
            ArmyCell(14,"HOUSE + ARMORY",()=>{},false);
        }
        private void BuildingThumbnail(Button button,ArenaTeam team,VillageBuildOrder kind){
            if(!view.visuals)return;var icon=view.visuals.ResolveBuildingIcon(team,kind);if(!icon)return;
            var r=Rect("Authored building render",button.transform,new Vector2(.02f,.04f),new Vector2(.30f,.96f));var art=r.gameObject.AddComponent<RawImage>();art.texture=icon;art.raycastTarget=false;
            var fit=r.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)icon.width/Mathf.Max(1,icon.height);
            var label=button.GetComponentInChildren<Text>();label.rectTransform.anchorMin=new Vector2(.32f,0);label.rectTransform.anchorMax=Vector2.one;label.transform.SetAsLastSibling();
        }
        private void ConstructionMap(OfflineBattle b){
            var bank=b.GetVillage(b.Player.Team);summary.text=$"BUILD {selectedBuild.ToString().ToUpperInvariant()} • Wood {bank.Wood:0} Stone {bank.Stone:0} Food {bank.Food:0} Gold {bank.Gold:0} • Tap visible ground";
            TacticalMap(b,body,new Vector2(0,.14f),new Vector2(.55f,1),0,p=>Reply(b.OrderPlayerConstruction(selectedBuild,p),"Construction queued at selected site"));
            ButtonAt("Village",body,Vector2.zero,new Vector2(.27f,.13f),"VILLAGE",()=>{page=3;Rebuild();});
            ButtonAt("Army",body,new Vector2(.28f,0),new Vector2(.55f,.13f),"ARMY",()=>{page=10;Rebuild();});
            int i=0;foreach(var kind in new[]{VillageBuildOrder.House,VillageBuildOrder.Barracks,VillageBuildOrder.Farm,VillageBuildOrder.Depot,VillageBuildOrder.GuardPost,VillageBuildOrder.Market}){var k=kind;float top=1-i++/6f;var button=ButtonAt("Select "+k,body,new Vector2(.57f,top-.15f),new Vector2(1,top-.01f),(k==VillageBuildOrder.Barracks?"ARMORY / BARRACKS":k.ToString().ToUpperInvariant())+(k==selectedBuild?" • SELECTED":""),()=>{selectedBuild=k;Rebuild();});BuildingThumbnail(button,b.Player.Team,k);if(k==selectedBuild)button.GetComponent<Outline>().effectColor=new Color(1,.85f,.42f);}
        }
        private void UpdateNavigation(){
            if(navigationTabs==null)return;
            for(int i=0;i<navigationTabs.Length;i++){
                bool active=!showResult&&page==(i==navigationTabs.Length-1?10:view.IsEditorReview?i-1:i);
                navigationMarkers[i].enabled=active;
                navigationLabels[i].color=active?NavigationAccent:Color.white;
                navigationLabels[i].fontStyle=active?FontStyle.Bold:FontStyle.Normal;
            }
        }
        private void AudioPanel(){
            title.text="AUDIO SETTINGS";title.color=NavigationAccent;
            summary.text="Offline audio mix • saved on this device";
            var channels=new[]{ReviewAudioChannel.Master,ReviewAudioChannel.Music,ReviewAudioChannel.Effects,ReviewAudioChannel.Voice};
            for(int i=0;i<channels.Length;i++){
                var channel=channels[i];float top=.97f-i*.21f;
                Label(channel.ToString(),body,new Vector2(.02f,top-.17f),new Vector2(.29f,top),channel.ToString().ToUpperInvariant(),24);
                var value=Label("Gain",body,new Vector2(.81f,top-.17f),new Vector2(.98f,top),Mathf.RoundToInt(ReviewAudioSettings.Get(channel)*100)+"%",24);
                var track=Rect("Audio gain "+channel,body,new Vector2(.32f,top-.14f),new Vector2(.79f,top-.03f));
                var background=track.gameObject.AddComponent<Image>();background.color=new Color(.13f,.23f,.28f);
                var slider=track.gameObject.AddComponent<Slider>();slider.minValue=0;slider.maxValue=1;slider.wholeNumbers=false;
                var fillArea=Rect("Fill area",track,new Vector2(.02f,.17f),new Vector2(.98f,.83f));
                var fill=Rect("Fill",fillArea,Vector2.zero,Vector2.one).gameObject.AddComponent<Image>();fill.color=NavigationAccent;fill.raycastTarget=false;
                var handleArea=Rect("Handle area",track,new Vector2(.02f,0),new Vector2(.98f,1));
                var knob=Rect("Handle",handleArea,Vector2.zero,Vector2.one);knob.sizeDelta=new Vector2(24,0);
                var handle=knob.gameObject.AddComponent<Image>();handle.color=Color.white;
                slider.fillRect=fill.rectTransform;slider.handleRect=knob;slider.targetGraphic=handle;
                slider.SetValueWithoutNotify(ReviewAudioSettings.Get(channel));
                slider.onValueChanged.AddListener(v=>{ReviewAudioSettings.Set(channel,v);value.text=Mathf.RoundToInt(v*100)+"%";});
            }
            ButtonAt("Back to lobby",body,new Vector2(.04f,0),new Vector2(.48f,.12f),"BACK TO LOBBY",()=>{ReviewAudioSettings.Save();page=-1;Rebuild();});
            ButtonAt("Content updates",body,new Vector2(.52f,0),new Vector2(.96f,.12f),"CONTENT UPDATES",()=>{page=9;Rebuild();});
        }
        private void ContentPanel(){
            title.text="CONTENT UPDATES";title.color=NavigationAccent;
            summary.text="Optional signed audio and static art updates • offline content stays installed";
            contentStatus=Label("Content status",body,new Vector2(.05f,.46f),new Vector2(.95f,.93f),"",24);
            contentCheck=ButtonAt("Check content",body,new Vector2(.05f,.22f),new Vector2(.48f,.43f),"CHECK",()=>{var updater=GetComponent<EmpireContentUpdater>();if(updater)updater.Check();});
            contentDownload=ButtonAt("Download content",body,new Vector2(.52f,.22f),new Vector2(.95f,.43f),"DOWNLOAD",()=>{var updater=GetComponent<EmpireContentUpdater>();if(updater)updater.Download();});
            ButtonAt("Back to audio",body,new Vector2(.30f,0),new Vector2(.70f,.16f),"BACK",()=>{page=8;Rebuild();});
            RefreshContentPanel();
        }
        private void RefreshContentPanel(){
            if(page!=9||!contentStatus)return;
            var updater=GetComponent<EmpireContentUpdater>();
            contentStatus.text=updater?updater.Status+(updater.Busy?" • "+Mathf.RoundToInt(updater.Progress*100)+"%":""):"Content updater unavailable";
            if(contentCheck)contentCheck.interactable=updater&&updater.CanCheck;
            if(contentDownload)contentDownload.interactable=updater&&updater.CanDownload;
        }
        private void Lobby(){
            title.text="BUKLOD EMPIRE";title.color=AntiqueGold;if(view.Battle!=null)panelBackground.color=new Color(.045f,.038f,.034f,.83f);
            var stats=view.PracticeStats(selected);
            summary.text=stats==null?"GENESIS RIFT  |  Local practice arena":$"GENESIS RIFT  |  Local mastery {stats.Mastery}  •  {stats.completed} matches  •  {stats.wins} wins";
            var kit=HeroKitCatalog.Get(selected);
            var left=Rect("Selected hero feature",body,new Vector2(.01f,.03f),new Vector2(.47f,.97f));
            var bg=left.gameObject.AddComponent<Image>();bg.color=Color.Lerp(Navy,BattleEffects.Accent(selected),.18f);bg.raycastTarget=false;
            var portrait=ShowcaseTexture(true);
            if(portrait){
                var r=Rect("Selected hero portrait",left,new Vector2(.04f,.25f),new Vector2(.96f,.98f));
                var image=r.gameObject.AddComponent<RawImage>();image.texture=portrait;image.raycastTarget=false;
                var fit=r.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)portrait.width/portrait.height;
            }
            var name=Label("Selected hero name",left,new Vector2(.04f,.09f),new Vector2(.96f,.25f),kit.Name,32);name.color=Color.Lerp(BattleEffects.Accent(selected),Color.white,.40f);name.fontStyle=FontStyle.Bold;
            Label("Roster label",left,new Vector2(.04f,0),new Vector2(.96f,.09f),kit.RoleProfile.Label,16);
            var right=Rect("Play and settings",body,new Vector2(.49f,.03f),new Vector2(.99f,.97f));
            var practice=ButtonAt("Practice",right,new Vector2(0,.70f),Vector2.one,"PLAY OFFLINE  •  "+difficulty,StartNew);
            practice.GetComponentInChildren<Text>().color=NavigationAccent;
            ButtonAt("Hero selection",right,new Vector2(0,.49f),new Vector2(.49f,.67f),"HEROES",()=>{page=0;Rebuild();});
            ButtonAt("Match loadout",right,new Vector2(.51f,.49f),new Vector2(1,.67f),"LOADOUT",()=>{page=1;Rebuild();});
            ButtonAt("Settings",right,new Vector2(0,.28f),new Vector2(.49f,.46f),"CONTROLS",()=>{page=7;Rebuild();});
            ButtonAt("Sound",right,new Vector2(.51f,.28f),new Vector2(1,.46f),"AUDIO SETTINGS",()=>{page=8;Rebuild();});
            var motion=view.MotionPreview;
            ButtonAt("Beginner guide",right,new Vector2(.63f,.05f),new Vector2(1,.24f),ReviewPracticeGuide.Enabled?"GUIDE ON":"GUIDE OFF",()=>{ReviewPracticeGuide.SetEnabled(!ReviewPracticeGuide.Enabled);Rebuild();});
            if(motion){
                ButtonAt("Motion comparison",right,new Vector2(0,.05f),new Vector2(.60f,.24f),
                    "NEXT MATCH MOTION: "+(motion.Requested?"AUTHORED PREVIEW":"ORIGINAL"),()=>{motion.SetRequested(!motion.Requested);Rebuild();});
            }else{
                var offline=ButtonAt("Offline scope",right,new Vector2(0,.05f),new Vector2(.60f,.24f),"OFFLINE ONLY • NO ACCOUNT SYNC",()=>{});
                offline.interactable=false;
            }
        }
        private void Rebuild(){
            UpdateNavigation();resultStats=null;resultActions=null;resultEmblem=null;
            foreach(Transform child in body){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            var b=view.Battle;var p=b?.Player;bool active=Active;
            if(!view.IsEditorReview||showResult||confirmRestart||!(page==-1&&(pregame==null||!pregame.InWizard)||page==0&&heroDetail||page==6))HideShowcase();
            if(view.IsEditorReview&&navigationTabs!=null)for(int i=0;i<navigationTabs.Length;i++)navigationTabs[i].interactable=(active&&matchStarted)||i<3||i==7||i==8;
            if(resumeButton)resumeButton.interactable=active&&(!view.IsEditorReview||matchStarted)&&!confirmRestart;
            title.text=b!=null&&b.Finished?(b.Winner.HasValue?(b.Winner.Value==ArenaTeam.Lux?"VICTORY":"DEFEAT"):"DRAW"):(view.IsEditorReview?"OFFLINE TEST — NOT FOR RELEASE":"OFFLINE TRAINING");
            summary.text=b==null?"Free offline training":$"Lv {p.State.Level}  Gold {p.Gold}  K/D/A {p.Kills}/{p.Deaths}/{p.Assists}  •  Lux {b.RemainingUnits(ArenaTeam.Lux)} : Tenebra {b.RemainingUnits(ArenaTeam.Tenebra)}  •  No persistent rewards"+(b.Finished?" • "+b.EndReason:"");
            ConfigurePregameControls();
            if(view.IsEditorReview&&showResult&&b!=null&&b.Finished){
                bool won=b.Winner==p.Team,draw=!b.Winner.HasValue;
                var accent=draw?new Color(.82f,.87f,.94f):won?new Color(1,.82f,.38f):new Color(1,.50f,.43f);
                title.text=ReviewResultPresentation.Outcome(p.Team,b.Winner);title.color=accent;
                summary.text=ReviewResultPresentation.Faction(b.Winner)+"  •  "+b.EndReason+"  •  "+(b.Time/60).ToString("0.0")+" min";
                panelBackground.color=draw?Navy:won?new Color(.065f,.14f,.12f,.98f):new Color(.15f,.065f,.085f,.98f);
                var left=Rect("Result hero",body,new Vector2(.02f,.06f),new Vector2(.37f,.98f));
                var portrait=reviewPortraits?reviewPortraits.Find(p.State.Kit.Id,true):null;
                if(portrait){
                    var r=Rect("Result model capture",left,new Vector2(.06f,.22f),new Vector2(.94f,.98f));
                    var img=r.gameObject.AddComponent<RawImage>();img.texture=portrait;img.raycastTarget=false;
                    var fit=img.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)portrait.width/portrait.height;
                }
                var name=Label("Result hero name",left,new Vector2(.04f,.10f),new Vector2(.96f,.22f),p.State.Kit.Name,24);name.color=accent;
                Label("Match level",left,new Vector2(.04f,0),new Vector2(.96f,.10f),"MATCH LEVEL "+p.State.Level,17);
                var right=Rect("Result details",body,new Vector2(.40f,.04f),new Vector2(.98f,.98f));
                resultEmblem=Label("Outcome emblem",right,new Vector2(0,.78f),Vector2.one,ReviewResultPresentation.Faction(b.Winner),36).rectTransform;
                resultEmblem.GetComponent<Text>().color=accent;
                var statsPanel=Rect("Actual match statistics",right,new Vector2(0,.33f),new Vector2(1,.77f));
                resultStats=statsPanel.gameObject.AddComponent<CanvasGroup>();
                string[] names={"KILLS","DEATHS","ASSISTS","DAMAGE DEALT","DAMAGE TAKEN","MATCH GOLD"};
                string[] values={p.Kills.ToString(),p.Deaths.ToString(),p.Assists.ToString(),p.DamageDealt.ToString("0"),p.DamageTaken.ToString("0"),p.Gold.ToString()};
                for(int i=0;i<6;i++){
                    float x=(i%3)/3f,y=1-(i/3+1)*.5f;
                    var cell=Rect("Result "+names[i],statsPanel,new Vector2(x+.012f,y+.02f),new Vector2(x+1f/3-.012f,y+.48f));
                    var backdrop=cell.gameObject.AddComponent<Image>();backdrop.color=new Color(.10f,.18f,.23f,.92f);backdrop.raycastTarget=false;
                    Label("Statistic value",cell,new Vector2(.03f,.29f),new Vector2(.97f,.98f),values[i],29).color=accent;
                    Label("Statistic label",cell,new Vector2(.03f,.02f),new Vector2(.97f,.28f),names[i],15);
                }
                var stats=view.PracticeStats(view.selectedHero);
                string local=stats==null?view.PracticeResultStatus:$"{view.PracticeResultStatus}  •  Mastery {stats.Mastery}  •  {stats.completed} matches";
                Label("Offline scope",right,new Vector2(0,.16f),new Vector2(1,.32f),local+"\n"+ArenaProgression.TrainingResult(true),17);
                var actions=Rect("Result navigation",right,Vector2.zero,new Vector2(1,.15f));resultActions=actions.gameObject.AddComponent<CanvasGroup>();
                ButtonAt("Return to lobby",actions,Vector2.zero,new Vector2(.48f,1),"RETURN TO LOBBY",()=>{showResult=false;page=-1;Rebuild();});
                ButtonAt("Choose next hero",actions,new Vector2(.52f,0),Vector2.one,"CHOOSE NEXT HERO",()=>{showResult=false;page=0;heroDetail=false;Rebuild();});
                ApplyResultReveal();return;
            }
            title.color=Color.white;panelBackground.color=Navy;title.rectTransform.localScale=Vector3.one;
            if(view.IsEditorReview&&page==8){AudioPanel();return;}
            if(view.IsEditorReview&&page==9){ContentPanel();return;}
            if(view.IsEditorReview&&confirmRestart){
                title.text="START A NEW MATCH?";summary.text="The unfinished local match will be discarded.";
                Label("Restart scope",body,new Vector2(.08f,.42f),new Vector2(.92f,.90f),"No BP, permanent XP or Sacred Stone transaction will occur.",25);
                ButtonAt("Keep match",body,new Vector2(.08f,.10f),new Vector2(.47f,.36f),"KEEP CURRENT MATCH",()=>{confirmRestart=false;Rebuild();});
                ButtonAt("Discard match",body,new Vector2(.53f,.10f),new Vector2(.92f,.36f),"START NEW MATCH",()=>{confirmRestart=false;OpenPregame();});return;
            }
            if(pregame!=null&&RenderPregame())return;
            if(view.IsEditorReview&&page==-1){Lobby();return;}
            if(page==0){
                if(view.IsEditorReview&&heroDetail){HeroDetails();return;}
                for(int i=0;i<HeroKitCatalog.All.Count;i++){var kit=HeroKitCatalog.All[i];if(view.IsEditorReview)HeroCard(i,kit);else Cell(i,5,3,(selected==kit.Id?"✓ ":"")+kit.Name+"\n"+kit.RoleProfile.Role,()=>{selected=kit.Id;Rebuild();});}
                if(view.IsEditorReview){var kit=HeroKitCatalog.Get(selected);summary.text=kit.Name+"  •  "+kit.RoleProfile.Label+"  •  "+kit.Passive.Replace('_',' ')+"  •  "+string.Join(" / ",new[]{kit.Primary.Id,kit.Secondary.Id,kit.Ultimate.Id}.Select(x=>x.Replace('_',' ')));}
                if(pregame?.Stage==ReviewMatchStage.Hero)return;
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
                var bank=b.GetVillage(p.Team);var gatherers=b.Units.Where(u=>u.Team==p.Team&&u.Villager?.Job.Effect==VillageEffect.Gather&&u.State.Alive).OrderBy(u=>u.Id).ToArray();
                var worker=gatherers.FirstOrDefault(u=>u.Villager.Job.Id==selectedGatherer)??gatherers.FirstOrDefault();string id=worker?.Villager.Job.Id;selectedGatherer=id;
                summary.text=$"Wood {bank.Wood:0}  Stone {bank.Stone:0}  Food {bank.Food:0}  Crystal {bank.Crystal:0}  Gold {bank.Gold:0}  •  Cargo {(worker?.Cargo??0):0}  •  Population {b.PopulationUsed(p.Team)}/{b.PopulationCapacity(p.Team)}";
                bool can=active&&b.Time<OfflineMatchRules.MatchLimit;bool working=can&&worker!=null&&worker.State.Alive;
                Cell(0,5,5,"Auto gather",()=>Reply(b.OrderPlayerResource(id,null),"Auto gathering"),working);
                int i=1;foreach(VillageResourceKind kind in Enum.GetValues(typeof(VillageResourceKind))){var k=kind;Cell(i++,5,5,"Gather "+k,()=>Reply(b.OrderPlayerResource(id,k),"Worker assigned to "+k),working);}
                Cell(6,5,5,"Return cargo",()=>Reply(b.OrderPlayerWorker(id,VillageWorkerOrder.Return),"Return ordered"),working);
                Cell(7,5,5,"Hold worker",()=>Reply(b.OrderPlayerWorker(id,VillageWorkerOrder.Hold),"Worker held"),working);
                int j=8;foreach(var kind in new[]{VillageBuildOrder.Depot,VillageBuildOrder.GuardPost,VillageBuildOrder.Farm,VillageBuildOrder.Barracks,VillageBuildOrder.Market,VillageBuildOrder.House}){var k=kind;Cell(j++,5,5,"Build "+(k==VillageBuildOrder.Barracks?"Armory / Barracks":k.ToString()),()=>Reply(b.OrderPlayerConstructionNearBase(k),"Construction queued"),can&&!b.HasConstructionOrder(p.Team));}
                Cell(14,5,5,"Repair lowest HP",()=>Reply(b.OrderPlayerRepairMostDamaged(),"Repair queued"),can&&!b.HasConstructionOrder(p.Team));
                Cell(15,5,5,"Cancel construction",()=>Reply(b.CancelPlayerConstruction(),"Cancelled"),can&&b.HasConstructionOrder(p.Team));
                var builder=b.Units.FirstOrDefault(u=>u.Team==p.Team&&u.Villager?.Job.Effect==VillageEffect.Build);
                Cell(16,5,5,builder?.Construction!=null?builder.Construction.Kind+" "+builder.Construction.Progress.ToString("0.0")+"s":"Builder idle",()=>{},false);
                Cell(17,5,5,"Worker: "+(id??"none"),()=>{int index=System.Array.IndexOf(gatherers,worker);selectedGatherer=gatherers[(index+1)%gatherers.Length].Villager.Job.Id;Rebuild();},gatherers.Length>1);
                Cell(18,5,5,b.RecruitmentPending(p.Team)?"Recruiting (12s)":"Recruit: 20 wood + 30 food",()=>Reply(b.RecruitPlayerGatherer(),"Recruitment queued"),can&&b.CanRecruitPlayerGatherer);
                Cell(19,5,5,"Cancel recruitment",()=>Reply(b.CancelPlayerRecruitment(),"Recruitment cancelled"),can&&b.RecruitmentPending(p.Team));
                Cell(20,5,5,"Armory: "+b.PlayerMilitaryRole,()=>Reply(b.OrderPlayerMilitaryRole((MinionRole)(((int)b.PlayerMilitaryRole+1)%5)),"Military role selected"),can);
                Cell(21,5,5,"Army: "+b.PlayerArmyOrder,()=>Reply(b.OrderPlayerArmy((VillageArmyOrder)(((int)b.PlayerArmyOrder+1)%4)),"Army order issued"),can);
                Cell(22,5,5,"House + barracks required",()=>{},false);
                Cell(23,5,5,"Soldiers "+b.PaidTroops(p.Team),()=>{page=10;Rebuild();},can);
                Cell(24,5,5,"Choose build site",()=>{page=11;Rebuild();},can);
            }else if(page==4&&b!=null){
                var bank=b.GetVillage(p.Team);summary.text=$"Village gold {bank.Gold:0}  •  Buy 10 units / 15 gold  •  Sell 10 units / 6 gold  •  Living market required";
                int i=0;foreach(var kind in new[]{VillageResourceKind.Wood,VillageResourceKind.Stone,VillageResourceKind.Food,VillageResourceKind.Crystal}){var k=kind;Cell(i++,4,2,"Buy "+k,()=>Reply(b.TradePlayerResource(k,true),"Trade complete"),active);Cell(i++,4,2,"Sell "+k,()=>Reply(b.TradePlayerResource(k,false),"Trade complete"),active);}
            }else if(page==7){
                ControlSettingsPage();
            }else if(page==11&&b!=null&&!b.Finished){
                ConstructionMap(b);
            }else if(page==10&&b!=null&&!b.Finished){
                ArmyPanel(b);
            }else if(page==6){
                RelicInventory(b);
            }else if(page==5&&b!=null){
                summary.text=$"Damage {p.DamageDealt:0} dealt / {p.DamageTaken:0} taken • Relics {p.Relics.Count} • Nearest visible field targets";
                int i=0;
                var counterTarget=b.PracticeCounterTarget;
                Cell(i++,4,5,b.PracticeCounterUsed?"Practice counter used":counterTarget==null?"No counter target":"Counter "+counterTarget.State.Kit.Name,()=>Reply(counterTarget!=null&&b.TryPracticeCounter(counterTarget.State.Kit.Id,counterTarget.Id),"Practice counter activated; no stone spent"),active&&counterTarget!=null);
                foreach(var u in b.Units.Where(u=>u.Team!=p.Team&&u.State.Alive&&b.IsVisibleTo(p.Team,u)&&Vector2.Distance(p.Position,u.Position)<=p.State.Kit.BasicRange).OrderBy(u=>Vector2.Distance(p.Position,u.Position)).Take(5)){var target=u;Cell(i++,4,5,"Attack "+(u.State.Kit?.Name??u.Kind.ToString()),()=>{Close();b.PlayerAttackUnit(target.Id);},active);}
                foreach(var camp in b.Camps.Where(c=>c.Alive&&b.IsPositionVisibleTo(p.Team,c.Position)&&Vector2.Distance(p.Position,c.Position)<=p.State.Kit.BasicRange).OrderBy(c=>Vector2.Distance(p.Position,c.Position)).Take(3)){var target=camp;Cell(i++,4,5,"Attack "+camp.Kind,()=>{Close();b.AttackNeutralPlayer(target.Id);},active);}
                foreach(var drop in b.Drops.Where(x=>Vector2.Distance(p.Position,x.Position)<=ArenaPickupCatalog.Radius).Take(4)){var target=drop;Cell(i++,4,5,"Pick "+drop.Item.Name,()=>Reply(b.CollectPlayerPickup(target.Id),"Picked up",target.Item.Effect),active);}
                foreach(var drop in b.RelicDrops.Where(x=>Vector2.Distance(p.Position,x.Position)<=ArenaRelicCatalog.Radius).Take(4)){var target=drop;Cell(i++,4,5,"Relic "+drop.Item.Name,()=>Reply(b.CollectPlayerRelic(target.Id),"Relic acquired"),active);}
                if(i==0)Cell(0,4,5,"No nearby target",()=>{},false);
            }
        }
        private static readonly string[] ControlNames={"Move","Attack","Skill 1","Skill 2","Ultimate","Tactic","Recall","Minion","Tower"};
        private void AdjustControl(Vector2 move,float size){
            bool ok=ArenaControlSettings.Adjust(selectedControl,move,size,MobileBattleInput.SafeArea);
            feedback.text=ok?"Saved on this device":"Cannot overlap another control or leave the play area";Rebuild();
        }
        private void ControlSettingsPage(){
            var center=ArenaControlSettings.Centers[selectedControl];
            summary.text=$"{ControlNames[selectedControl]}  X {center.x:P0} / Y {center.y:P0}  Size {ArenaControlSettings.Scale(selectedControl):P0}  Zoom {1/ArenaControlSettings.Zoom:0.00}x";
            for(int i=0;i<ControlNames.Length;i++){int index=i;Cell(i,5,4,(i==selectedControl?"✓ ":"")+ControlNames[i],()=>{selectedControl=index;Rebuild();});}
            Cell(9,5,4,"LEFT",()=>AdjustControl(new Vector2(-.025f,0),0));
            Cell(10,5,4,"RIGHT",()=>AdjustControl(new Vector2(.025f,0),0));
            Cell(11,5,4,"DOWN",()=>AdjustControl(new Vector2(0,-.025f),0));
            Cell(12,5,4,"UP",()=>AdjustControl(new Vector2(0,.025f),0));
            Cell(13,5,4,"SMALLER",()=>AdjustControl(Vector2.zero,-.1f));
            Cell(14,5,4,"LARGER",()=>AdjustControl(Vector2.zero,.1f));
            Cell(15,5,4,"ZOOM +",()=>{ArenaControlSettings.ChangeZoom(-.1f);Rebuild();});
            Cell(16,5,4,"ZOOM −",()=>{ArenaControlSettings.ChangeZoom(.1f);Rebuild();});
            Cell(17,5,4,ArenaControlSettings.DetailedInfo?"INFO FULL":"INFO MINIMAL",()=>{ArenaControlSettings.ToggleInfo();Rebuild();});
            Cell(18,5,4,ArenaControlSettings.Fullscreen?"FULLSCREEN ON":"FULLSCREEN OFF",()=>{ArenaControlSettings.ToggleFullscreen();Rebuild();});
            Cell(19,5,4,"DRAG EDITOR",OpenLayoutEditor,view.GetComponent<BattleHud>()!=null||authored&&authored.action);
        }
        private void OpenLayoutEditor(){
            if(layoutEditor!=null)return;
            var hud=view.GetComponent<BattleHud>();
            var sprite=hud?hud.ControlPreviewSprite:authored?authored.action:null;
            if(!sprite)return;
            panelGroup.interactable=false;
            layoutEditor=new ArenaHudLayoutEditor(safeRoot,font,sprite,()=>{layoutEditor=null;panelGroup.interactable=true;Rebuild();});
        }
        private void Resume(){
            if(starting){
                if(pregame?.Stage==ReviewMatchStage.Loading)cancelPreparation=true;
                return;
            }
            if(layoutEditor!=null||confirmRestart)return;
            if(pregame!=null&&pregame.InWizard){
                if(pregame.Back())ShowPregameStage();
                return;
            }
            if(Active&&(!view.IsEditorReview||matchStarted)){
                pregame?.ResumeBattle();
                Close();
            }
        }
        private void StartNew(){
            if(starting)return;
            if(pregame!=null){
                if(confirmRestart)return;
                if(pregame.InWizard){AdvancePregame();return;}
                if(matchStarted&&Active){confirmRestart=true;Rebuild();return;}
                OpenPregame();
                return;
            }
            BeginMatch();
        }
        private IEnumerator PrepareReviewMatch(){
            starting=true;cancelPreparation=false;view.SetPaused(true);Rebuild();
            title.color=BattleEffects.Accent(selected);feedback.text="";
            var heroTexture=ShowcaseTexture(true);
            if(heroTexture is RenderTexture&&livePreview){
                foreach(Transform child in body){child.gameObject.SetActive(false);Destroy(child.gameObject);}
                title.text=HeroKitCatalog.Get(selected).Name.ToUpperInvariant()+" • LOCKED IN";
                var image=Rect("Locked hero preview",body,new Vector2(.25f,0),new Vector2(.75f,1)).gameObject.AddComponent<RawImage>();
                image.texture=heroTexture;image.raycastTarget=false;
                var aspect=image.gameObject.AddComponent<AspectRatioFitter>();
                aspect.aspectMode=AspectRatioFitter.AspectMode.FitInParent;
                aspect.aspectRatio=(float)heroTexture.width/heroTexture.height;
                livePreview.SetPalette(previewPalette);
                livePreview.PlayEntrance();
                float elapsed=0;
                while(elapsed<.65f&&!cancelPreparation){
                    if(Application.isFocused)elapsed+=Mathf.Min(.05f,Time.unscaledDeltaTime);
                    yield return null;
                }
                HideShowcase();
            }
            Rebuild();
            yield return null;
            while(!Application.isFocused&&!cancelPreparation)yield return null;
            if(cancelPreparation){
                pregame.FailLoading();
                starting=false;
                ShowPregameStage();
                yield break;
            }
            panelGroup.interactable=false;
            var previousMatch=view.Battle;
            bool previouslyStarted=matchStarted;
            Exception initializationError=null;
            try{BeginMatch(false);}
            catch(Exception error){initializationError=error;}
            if(initializationError!=null){
                Debug.LogException(initializationError);
                view.SetPaused(true);
                matchStarted=previouslyStarted&&previousMatch!=null&&ReferenceEquals(previousMatch,view.Battle);
                pregame.FailLoading();
                starting=false;panelGroup.interactable=true;
                ShowPregameStage();
                feedback.color=new Color(1f,.70f,.49f);
                feedback.text=matchStarted?"Initialization failed. Previous match retained.":"Initialization failed. Check the local assets and try again.";
                yield break;
            }

            pregame.CompleteLoading();
            page=-1;
            if(authored&&authored.entrance)authored.entrance.Open();
            title.text="GENESIS RIFT";summary.text="Enter the battlefield";feedback.text="";
            float doorElapsed=0,duration=authored&&authored.entrance?ArenaEntranceDoor.Duration:.55f;
            while(doorElapsed<duration&&Application.isFocused){
                doorElapsed+=Time.unscaledDeltaTime;
                panelGroup.alpha=1-Mathf.SmoothStep(0,1,doorElapsed/duration);
                yield return null;
            }
            if(authored&&authored.entrance&&authored.entrance.IsOpening)authored.entrance.Complete();
            if(Application.isFocused)Close();
            else {starting=false;shown=true;view.SetPaused(true);Rebuild();}
            panelGroup.alpha=1;starting=false;panelGroup.interactable=true;
        }
        private void BeginMatch(bool close=true){
            CovenantLoadout? loadout=enableCovenant?new CovenantLoadout(path,first,second,third):(CovenantLoadout?)null;
            view.StartMatch(selected,difficulty,tactic,loadout,autoTraining,seed);matchStarted=true;confirmRestart=false;heroDetail=false;selectedGatherer=null;selectedBag=selectedBank=-1;selectedSoldierId=0;lastFinished=false;showResult=false;resultRevealAt=-1;title.rectTransform.localScale=Vector3.one;if(close)Close();else view.SetPaused(true);
        }
        private void Close(){HideShowcase();if(view.IsEditorReview){ReviewAudioSettings.Save();var dialogue=GetComponent<ReviewHeroDialogue>();if(dialogue)dialogue.Stop();}shown=false;panel.gameObject.SetActive(false);view.SetPaused(false);}
        private void ApplyResultReveal(){
            float elapsed=resultRevealAt<0?2f:Time.unscaledTime-resultRevealAt;
            float headline=ReviewResultPresentation.Reveal(elapsed,0),stats=ReviewResultPresentation.Reveal(elapsed,.18f),actions=ReviewResultPresentation.Reveal(elapsed,.40f);
            title.rectTransform.localScale=Vector3.one*Mathf.Lerp(.82f,1,headline);
            if(resultEmblem)resultEmblem.localScale=Vector3.one*Mathf.Lerp(.85f,1,headline);
            if(resultStats)resultStats.alpha=stats;
            if(resultActions){resultActions.alpha=actions;resultActions.interactable=actions>.99f;resultActions.blocksRaycasts=actions>.99f;}
        }
        private void Update(){
            RefreshContentPanel();
            bool quickVisible=!shown&&!starting&&!view.Paused&&Active&&!view.Battle.AutonomousTraining;
            if(quickBag)quickBag.gameObject.SetActive(quickVisible);
            if(quickOrders)quickOrders.gameObject.SetActive(quickVisible);
            if(fieldOrderMatch!=view.Battle||!quickVisible){fieldOrderMatch=view.Battle;if(fieldOrderMode!=0){fieldOrderMode=0;RefreshFieldOrderText();}}
            if(fieldOrderMode!=0&&fieldOrderHintUntil>0&&Time.unscaledTime>=fieldOrderHintUntil)RefreshFieldOrderText();
            if(Time.unscaledTime>=nextLootRefresh){RefreshQuickPotion(quickHealth,quickHealthLabel,"health",view.Battle,quickVisible);RefreshQuickPotion(quickMana,quickManaLabel,"mana",view.Battle,quickVisible);}
            if(quickLoot&&Time.unscaledTime>=nextLootRefresh){nextLootRefresh=Time.unscaledTime+.12f;string item="";bool show=!shown&&!starting&&!view.Paused&&view.Battle!=null&&view.Battle.TryNearbyLoot(out item);quickLoot.gameObject.SetActive(show);if(show)quickLootLabel.text="PICK UP\n"+item;}
            if(lastSafe!=MobileBattleInput.SafeArea){ApplySafeArea();if(layoutEditor!=null)layoutEditor.Refresh();}
            if(starting||layoutEditor!=null)return;
            bool finished=view.Battle!=null&&view.Battle.Finished;
            if(finished&&!lastFinished&&!shown&&view.ShowingCoreCollapse)return;
            if(finished&&!lastFinished&&view.IsEditorReview){showResult=true;resultRevealAt=Time.unscaledTime;}
            if((finished&&!lastFinished)||(!shown&&view.Paused))Open();lastFinished=finished;
            if(shown&&finished&&showResult&&resultRevealAt>=0){
                ApplyResultReveal();if(Time.unscaledTime-resultRevealAt>=.9f)resultRevealAt=-1;
            }
        }
        private void OnEnable(){
            if(pregame?.Stage==ReviewMatchStage.Startup)StartCoroutine(RevealStartup());
            else if(pregame!=null&&shown)Rebuild();
        }
        private void OnDisable(){
            if(pregame==null)return;
            StopAllCoroutines();
            HideShowcase();
            if(!starting)return;
            if(pregame.FailLoading()){
                page=-1;
                heroDetail=false;
            }
            starting=false;
            panelGroup.alpha=1;
            panelGroup.interactable=true;
        }
        private void OnApplicationPause(bool paused){if(paused){fieldOrderMode=0;RefreshFieldOrderText();if(view&&view.IsEditorReview)ReviewAudioSettings.Save();}}
        private void OnDestroy(){HideShowcase();if(view&&view.IsEditorReview)ReviewAudioSettings.Save();if(ownedEventSystem)Destroy(ownedEventSystem);}
    }
}
