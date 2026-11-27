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
        private Text title,summary,feedback;private Font font;private GameObject ownedEventSystem;
        private string selected;private string selectedGatherer;private bool shown,lastFinished;private int page,seed=1;
        private Image panelBackground;private RectTransform safeRoot;private Rect lastSafe;private int selectedControl;private ArenaHudLayoutEditor layoutEditor;private ArenaAuthoredUi authored;private float resultRevealAt=-1;private bool showResult,starting,heroDetail,fullBody=true,confirmRestart,matchStarted;private CanvasGroup panelGroup;private ReviewPortraits reviewPortraits;
        private int evolutionPreviewLevel=1;
        private ArenaDifficulty difficulty=ArenaDifficulty.Normal;
        private ArenaTactic tactic=ArenaTactic.Renew;
        private CovenantPath path=CovenantPath.Valor;
        private CovenantTalent first=CovenantTalent.Fortitude,second=CovenantTalent.Resolve,third=CovenantTalent.Sustenance;
        private bool autoTraining,enableCovenant=true;
        private Button[] navigationTabs;
        private Button resumeButton,startButton;
        private CanvasGroup resultStats,resultActions;private RectTransform resultEmblem;
        ReviewMenuArt backdrop;CanvasGroup bodyReveal;Text stageLine;RectTransform stageSteps;float bodyOpened;string lastScreen;
        private Image[] navigationMarkers;
        private Text[] navigationLabels;
        private static readonly Color NavigationAccent=new Color(.63f,.94f,.42f,1);
        private static readonly string[] GearIds={"blade","armor","boots","sealbreaker","withering_thorn","precision","fervor","renewal","wisdom","aegis","vitality","giantbane"};
        private static readonly Color Navy=new Color(.055f,.09f,.13f,.98f);
        private RectTransform Rect(string name,Transform parent,Vector2 min,Vector2 max){
            var go=new GameObject(name,typeof(RectTransform));var r=go.GetComponent<RectTransform>();r.SetParent(parent,false);r.anchorMin=min;r.anchorMax=max;r.offsetMin=r.offsetMax=Vector2.zero;return r;
        }
        private Text Label(string name,Transform parent,Vector2 min,Vector2 max,string value,int size){
            var r=Rect(name,parent,min,max);var t=r.gameObject.AddComponent<Text>();t.font=font;t.text=value;t.fontSize=size;t.color=Color.white;t.alignment=TextAnchor.MiddleCenter;t.resizeTextForBestFit=true;t.resizeTextMinSize=12;t.resizeTextMaxSize=size;t.raycastTarget=false;return t;
        }
        private Button ButtonAt(string name,Transform parent,Vector2 min,Vector2 max,string value,Action action){
            var r=Rect(name,parent,min,max);var image=r.gameObject.AddComponent<Image>();image.color=new Color(.15f,.31f,.32f,1);if(authored){image.sprite=authored.menuButton;image.type=Image.Type.Sliced;image.color=Color.white;}var b=r.gameObject.AddComponent<Button>();b.targetGraphic=image;if(view&&view.IsEditorReview){image.sprite=null;image.type=Image.Type.Simple;image.color=new Color(.055f,.095f,.13f,.97f);var colors=b.colors;colors.highlightedColor=new Color(1.12f,1.16f,1.2f);colors.pressedColor=new Color(.78f,.88f,.95f);colors.disabledColor=new Color(.45f,.49f,.53f,.65f);b.colors=colors;AddArt(r,ReviewMenuArt.Kind.Button,name=="Start"||name=="Practice"?NavigationAccent:new Color(.62f,.72f,.80f),.7f);}
            b.onClick.AddListener(()=>{if(authored)authored.Click();action();});if(view&&view.IsEditorReview)r.gameObject.AddComponent<ReviewButtonMotion>();Label("Label",r,Vector2.zero,Vector2.one,value,23);return b;
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
            ButtonAt("Zoom in",safeRoot,new Vector2(.91f,.81f),new Vector2(.99f,.89f),"+",()=>ArenaControlSettings.ChangeZoom(-.1f));
            ButtonAt("Zoom out",safeRoot,new Vector2(.91f,.71f),new Vector2(.99f,.79f),"−",()=>ArenaControlSettings.ChangeZoom(.1f));
            panel=Rect("Session panel",safeRoot,Vector2.zero,Vector2.one);panelBackground=panel.gameObject.AddComponent<Image>();panelBackground.color=Navy;if(authored){panelBackground.sprite=authored.menuPanel;panelBackground.type=Image.Type.Sliced;panelBackground.color=Color.white;}panelGroup=panel.gameObject.AddComponent<CanvasGroup>();
            title=Label("Title",panel,new Vector2(.08f,.88f),new Vector2(.92f,.98f),"OFFLINE TRAINING",36);
            summary=Label("Summary",panel,new Vector2(.04f,.80f),new Vector2(.96f,.88f),"",21);
            if(view.IsEditorReview){
                panelBackground.sprite=null;panelBackground.color=Navy;backdrop=AddArt(panel,ReviewMenuArt.Kind.Backdrop,NavigationAccent,1);backdrop.transform.SetAsFirstSibling();
                title.fontStyle=FontStyle.Bold;summary.color=new Color(.74f,.83f,.90f);
                var scope=Label("Mode status",panel,new Vector2(.035f,.985f),new Vector2(.965f,1f),"OFFLINE PRACTICE  •  ONLINE NOT ENABLED",12);
                scope.color=new Color(.85f,.91f,.96f);
            }
            string[] tabs=view.IsEditorReview?new[]{"LOBBY","HEROES","LOADOUT","SHOP","VILLAGE","MARKET","FIELD","RELICS","SETTINGS"}:new[]{"MATCH","LOADOUT","SHOP","VILLAGE","MARKET","FIELD","HUD"};
            if(view.IsEditorReview){page=-1;flow=new ReviewMatchFlow();ReviewAudioSettings.ApplyMaster();}
            navigationTabs=new Button[tabs.Length];navigationMarkers=new Image[tabs.Length];navigationLabels=new Text[tabs.Length];
            for(int i=0;i<tabs.Length;i++){
                int tab=view.IsEditorReview?i-1:i;float step=.93f/tabs.Length;
                var button=ButtonAt(tabs[i],panel,new Vector2(.035f+i*step,.72f),new Vector2(.035f+(i+1)*step-.01f,.79f),tabs[i],()=>{showResult=false;heroDetail=false;confirmRestart=false;page=tab;feedback.text="";Rebuild();});
                navigationTabs[i]=button;navigationLabels[i]=button.GetComponentInChildren<Text>();
                var marker=Rect("Active section",button.transform,new Vector2(.12f,.025f),new Vector2(.88f,.095f)).gameObject.AddComponent<Image>();
                marker.color=NavigationAccent;marker.raycastTarget=false;navigationMarkers[i]=marker;
            }
            if(view.IsEditorReview){stageSteps=Rect("Preparation stages",panel,new Vector2(.04f,.72f),new Vector2(.96f,.79f));stageLine=Label("Stage progress",stageSteps,Vector2.zero,Vector2.one,"",18);stageLine.color=new Color(.76f,.87f,.94f);stageSteps.gameObject.SetActive(false);}
            body=Rect("Commands",panel,new Vector2(.035f,.18f),new Vector2(.965f,.71f));if(view.IsEditorReview)bodyReveal=body.gameObject.AddComponent<CanvasGroup>();
            feedback=Label("Feedback",panel,new Vector2(.03f,.10f),new Vector2(.97f,.18f),"",20);
            resumeButton=ButtonAt("Resume",panel,new Vector2(.06f,.015f),new Vector2(.46f,.10f),"RESUME CURRENT MATCH",Resume);
            var start=startButton=ButtonAt("Start",panel,new Vector2(.54f,.015f),new Vector2(.94f,.10f),"START NEW MATCH",StartNew);
            if(view.IsEditorReview){var startLabel=start.GetComponentInChildren<Text>();startLabel.color=NavigationAccent;startLabel.fontStyle=FontStyle.Bold;}
            Open();
            if(flow!=null)StartCoroutine(BootReview());
        }
        private void ApplySafeArea(){lastSafe=MobileBattleInput.SafeArea;safeRoot.anchorMin=new Vector2(lastSafe.xMin/Mathf.Max(1,Screen.width),lastSafe.yMin/Mathf.Max(1,Screen.height));safeRoot.anchorMax=new Vector2(lastSafe.xMax/Mathf.Max(1,Screen.width),lastSafe.yMax/Mathf.Max(1,Screen.height));}
        private void Open(){if(starting)return;panelGroup.alpha=1;shown=true;view.SetPaused(true);panel.gameObject.SetActive(true);feedback.text="";Rebuild();}
        private bool Active=>view.Battle!=null&&!view.Battle.Finished;
        private void Reply(bool ok,string success){feedback.text=ok?success:"Not available: check eligibility, funds, distance or cooldown.";Rebuild();}
        private void HeroCard(int i,HeroKit kit){
            float x=(i%5)/5f,y=.82f-(i/5+1)*.26f;
            var r=Rect(kit.Id,body,new Vector2(x+.008f,y+.01f),new Vector2(x+.192f,y+.25f));
            var accent=BattleEffects.Accent(kit.Id);bool chosen=kit.Id==selected;
            var bg=r.gameObject.AddComponent<Image>();bg.color=Color.Lerp(Navy,accent,chosen?.31f:.12f);
            var btn=r.gameObject.AddComponent<Button>();btn.targetGraphic=bg;r.gameObject.AddComponent<ReviewButtonMotion>();btn.onClick.AddListener(()=>{if(authored)authored.Click();selected=kit.Id;heroDetail=true;fullBody=true;evolutionPreviewLevel=1;var dialogue=GetComponent<ReviewHeroDialogue>();if(dialogue)feedback.text=dialogue.Select(kit.Id);Rebuild();});
            AddArt(r,ReviewMenuArt.Kind.Card,accent,chosen?1:.48f);
            var portrait=reviewPortraits?reviewPortraits.Find(kit.Id):null;
            float left=portrait ? .37f : .05f;
            if(portrait){
                var holder=Rect("Portrait frame",r,new Vector2(.025f,.05f),new Vector2(.35f,.92f));
                var pic=Rect("Captured portrait",holder,Vector2.zero,Vector2.one).gameObject.AddComponent<RawImage>();
                pic.texture=portrait;pic.raycastTarget=false;
                var fit=pic.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)portrait.width/portrait.height;
            }
            var name=Label("Hero name",r,new Vector2(left,.63f),new Vector2(.95f,.94f),(chosen?"✓ ":"")+kit.Name,27);name.color=accent;name.fontStyle=FontStyle.Bold;
            for(int j=0;j<3;j++){
                if(!SkillCueCatalog.TryGet(kit.Skill((SkillSlot)j).Id,out var cue))continue;
                var symbol=Rect("Skill "+j,r,new Vector2(left+(1-left)*(.05f+j*.30f),.23f),new Vector2(left+(1-left)*(.30f+j*.30f),.61f)).gameObject.AddComponent<ReviewSkillGlyph>();
                symbol.raycastTarget=false;symbol.SetCue(cue,accent);
            }
            var stats=view.PracticeStats(kit.Id);
            Label("Combat range",r,new Vector2(left,.02f),new Vector2(.97f,.22f),stats==null?$"ATK {kit.BasicDamage:0}  •  RNG {kit.BasicRange:0.#}":$"ATK {kit.BasicDamage:0}  •  M{stats.Mastery} / {stats.completed} matches",16);
        }
        private void HeroDetails(){
            var kit=HeroKitCatalog.Get(selected);var accent=BattleEffects.Accent(selected);
            title.text=kit.Name.ToUpperInvariant()+"  •  HERO PROFILE";title.color=accent;
            SacredStoneCatalog.TryGet(selected,out var stone);
            summary.text=stone==null?"Next match selection":stone.Name+"  •  "+stone.VirtueTl+"  •  Next match selection";
            var left=Rect("Hero showcase",body,new Vector2(.015f,.04f),new Vector2(.44f,.98f));
            var bg=left.gameObject.AddComponent<Image>();bg.color=Color.Lerp(Navy,accent,.13f);bg.raycastTarget=false;AddArt(left,ReviewMenuArt.Kind.Card,accent,.8f);
            var portrait=reviewPortraits?reviewPortraits.Find(selected,fullBody):null;
            if(!ShowModel(left,selected,!fullBody,new Vector2(.025f,.31f),new Vector2(.975f,.99f),fullBody?evolutionPreviewLevel:1)&&portrait){
                var r=Rect("Actual model capture",left,new Vector2(.04f,.21f),new Vector2(.96f,.99f));
                var image=r.gameObject.AddComponent<RawImage>();image.texture=portrait;image.raycastTarget=false;
                var fit=r.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)portrait.width/portrait.height;
            }
            ButtonAt("Portrait angle",left,new Vector2(.03f,.03f),new Vector2(.48f,.19f),fullBody?"FACE / ARMOR":"FULL BODY",()=>{fullBody=!fullBody;evolutionPreviewLevel=1;Rebuild();});
            ButtonAt("Locked evolution",left,new Vector2(.50f,.03f),new Vector2(.97f,.19f),"NEXT STAGE",()=>{evolutionPreviewLevel=ArenaProgression.NextPreviewLevel(evolutionPreviewLevel);fullBody=true;Rebuild();});
            if(evolutionPreviewLevel>1)Label("Locked evolution disclaimer",left,new Vector2(.03f,.88f),new Vector2(.97f,.99f),"L"+evolutionPreviewLevel+" • "+ArenaProgression.Evolution(evolutionPreviewLevel)+" • LOCKED PREVIEW",16).color=accent;
            ButtonAt("Rotate hero",left,new Vector2(.66f,.20f),new Vector2(.97f,.30f),"↻",()=>{if(showcase)showcase.Rotate(45);});
            ButtonAt("Practice palette",left,new Vector2(.03f,.20f),new Vector2(.62f,.30f),palette.ToString().ToUpperInvariant(),()=>{palette=(ReviewPalette)(((int)palette+1)%3);Rebuild();});
            var right=Rect("Hero profile",body,new Vector2(.46f,.04f),new Vector2(.99f,.98f));
            Label("Hero stats",right,new Vector2(0,.78f),Vector2.one,$"ATK {kit.BasicDamage:0}   RANGE {kit.BasicRange:0.#}   SPEED {kit.Speed:0.##}\nPassive: "+kit.Passive.Replace('_',' '),22);
            for(int i=0;i<3;i++){
                var spec=kit.Skill((SkillSlot)i);float y=.76f-i*.18f;
                var row=Rect("Skill "+i,right,new Vector2(0,y-.16f),new Vector2(1,y));
                var background=row.gameObject.AddComponent<Image>();background.color=new Color(.10f,.18f,.23f,.95f);background.raycastTarget=false;
                if(SkillCueCatalog.TryGet(spec.Id,out var cue)){
                    var glyph=Rect("Skill symbol",row,new Vector2(.02f,.08f),new Vector2(.16f,.92f)).gameObject.AddComponent<ReviewSkillGlyph>();glyph.raycastTarget=false;glyph.SetCue(cue,accent);
                }
                var slot=(SkillSlot)i;
                ButtonAt("Preview skill",row,new Vector2(.18f,.03f),new Vector2(.76f,.97f),spec.Id.Replace('_',' ')+"  ▷",()=>{try{if(showcase&&showcase.PlaySkill(slot,out string outcome)){feedback.text=outcome;if(slot==SkillSlot.Ultimate){var voice=GetComponent<ReviewHeroDialogue>();if(voice)voice.PreviewUltimate(selected);}}else feedback.text="Preview asset unavailable";}catch(Exception error){Debug.LogWarning("Skill review unavailable: "+error.GetType().Name);feedback.text="Skill trial unavailable; current match unchanged.";}});
                var cd=Label("Base cooldown",row,new Vector2(.77f,0),new Vector2(.98f,1),spec.Cooldown.ToString("0")+"s",20);cd.color=accent;
            }
            Label("Evolution scope",right,new Vector2(0,.10f),new Vector2(1,.21f),"Offline practice: local mastery only. Permanent evolution requires MAIN-verified BP eligibility and items.",16);
            ButtonAt("Back to roster",right,Vector2.zero,new Vector2(.47f,.10f),"ROSTER",()=>{heroDetail=false;Rebuild();});
            ButtonAt("Choose hero",right,new Vector2(.51f,0),new Vector2(1,.10f),"USE IN NEXT MATCH",()=>{heroDetail=false;if(flow!=null&&flow.Stage==ReviewMatchStage.Hero)AdvanceWizard();else{page=-1;Rebuild();}feedback.text=kit.Name+" selected for the next match.";});
        }
        private void RelicInventory(OfflineBattle battle){
            var p=battle.Player;
            var list=p.Relics.Values.OrderBy(x=>x.Slot,StringComparer.Ordinal).ToArray();
            summary.text=$"Match-local equipment  •  {list.Length} relics  •  {p.Gear.Count}/6 shop items";
            int row=0;
            foreach(string slot in new[]{"weapon","shield","armor","boots","jewel"}){
                var relic=list.FirstOrDefault(x=>x.Slot==slot);float top=1-row*.18f;
                var r=Rect("Relic "+slot,body,new Vector2(.02f,top-.16f),new Vector2(.98f,top-.015f));
                var background=r.gameObject.AddComponent<Image>();background.raycastTarget=false;background.color=new Color(.10f,.18f,.21f,.95f);
                var category=Label("Slot",r,new Vector2(.02f,.05f),new Vector2(.22f,.95f),slot.ToUpperInvariant(),20);
                category.color=relic==null?new Color(.58f,.67f,.69f):BattleFieldVisuals.TierColor(relic.Tier);
                var item=Label("Item",r,new Vector2(.23f,.05f),new Vector2(.78f,.95f),relic==null?"Empty":relic.Name,23);
                item.color=relic==null?new Color(.58f,.67f,.69f):Color.white;
                var tier=Label("Tier",r,new Vector2(.79f,.05f),new Vector2(.98f,.95f),relic==null?"—":"TIER "+relic.Tier,19);
                if(relic!=null)tier.color=BattleFieldVisuals.TierColor(relic.Tier);
                row++;
            }
            Label("Relic policy",body,new Vector2(.02f,.01f),new Vector2(.98f,.09f),"Practice inventory only • No persistent rewards",17);
        }
        private void UpdateNavigation(){
            if(navigationTabs==null)return;
            for(int i=0;i<navigationTabs.Length;i++){
                bool active=!showResult&&page==(view.IsEditorReview?i-1:i);
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
            ButtonAt("Back to lobby",body,new Vector2(.30f,0),new Vector2(.70f,.12f),"BACK TO LOBBY",()=>{ReviewAudioSettings.Save();page=-1;Rebuild();});
        }
        private void Lobby(){
            title.text="BUKLOD EMPIRE";title.color=NavigationAccent;
            var stats=view.PracticeStats(selected);
            summary.text=stats==null?"GENESIS RIFT  |  Local practice arena":$"GENESIS RIFT  |  Local mastery {stats.Mastery}  •  {stats.completed} matches  •  {stats.wins} wins";
            var kit=HeroKitCatalog.Get(selected);
            var left=Rect("Selected hero feature",body,new Vector2(.01f,.03f),new Vector2(.47f,.97f));
            var bg=left.gameObject.AddComponent<Image>();bg.color=Color.Lerp(Navy,BattleEffects.Accent(selected),.18f);bg.raycastTarget=false;AddArt(left,ReviewMenuArt.Kind.Card,BattleEffects.Accent(selected),.85f);
            var portrait=reviewPortraits?reviewPortraits.Find(selected,true):null;
            if(!ShowModel(left,selected,false,new Vector2(.025f,.24f),new Vector2(.975f,.99f))&&portrait){
                var r=Rect("Selected hero portrait",left,new Vector2(.04f,.25f),new Vector2(.96f,.98f));
                var image=r.gameObject.AddComponent<RawImage>();image.texture=portrait;image.raycastTarget=false;
                var fit=r.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)portrait.width/portrait.height;
            }
            var name=Label("Selected hero name",left,new Vector2(.04f,.09f),new Vector2(.96f,.25f),kit.Name,32);name.color=BattleEffects.Accent(selected);
            Label("Roster label",left,new Vector2(.04f,0),new Vector2(.96f,.09f),"13 HEROES  •  39 SKILLS",16);
            var right=Rect("Play and settings",body,new Vector2(.49f,.03f),new Vector2(.99f,.97f));
            var practice=ButtonAt("Practice",right,new Vector2(0,.70f),Vector2.one,"ENTER GENESIS RIFT  •  "+difficulty,StartNew);
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
            if(showcase)showcase.Hide();
            UpdateNavigation();resultStats=null;resultActions=null;resultEmblem=null;
            foreach(Transform child in body){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            var b=view.Battle;var p=b?.Player;bool active=Active;
            if(resumeButton)resumeButton.interactable=active&&(!view.IsEditorReview||matchStarted)&&!confirmRestart;
            if(flow!=null){ConfigureWizardControls();for(int i=0;i<navigationTabs.Length;i++)navigationTabs[i].interactable=(active&&matchStarted)||i<3||i>=8;ApplyScreenStyle();}
            title.text=b!=null&&b.Finished?(b.Winner.HasValue?(b.Winner.Value==ArenaTeam.Lux?"VICTORY":"DEFEAT"):"DRAW"):(view.IsEditorReview?"OFFLINE TEST — NOT FOR RELEASE":"OFFLINE TRAINING");
            summary.text=b==null?"Free offline training":$"Lv {p.State.Level}  Gold {p.Gold}  K/D/A {p.Kills}/{p.Deaths}/{p.Assists}  •  Lux {b.RemainingUnits(ArenaTeam.Lux)} : Tenebra {b.RemainingUnits(ArenaTeam.Tenebra)}  •  No persistent rewards"+(b.Finished?" • "+b.EndReason:"");
            if(view.IsEditorReview&&showResult&&b!=null&&b.Finished){
                bool won=b.Winner==p.Team,draw=!b.Winner.HasValue;
                var accent=draw?new Color(.82f,.87f,.94f):won?new Color(1,.82f,.38f):new Color(1,.50f,.43f);
                title.text=ReviewResultPresentation.Outcome(p.Team,b.Winner);title.color=accent;
                summary.text=ReviewResultPresentation.Faction(b.Winner)+"  •  "+b.EndReason+"  •  "+(b.Time/60).ToString("0.0")+" min";
                panelBackground.color=Navy;if(backdrop)backdrop.SetAccent(accent);
                var left=Rect("Result hero",body,new Vector2(.02f,.06f),new Vector2(.37f,.98f));AddArt(left,ReviewMenuArt.Kind.Card,accent,.85f);
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
                var crest=Rect("Outcome crest",left,new Vector2(.37f,.01f),new Vector2(.63f,.24f));crest.SetAsFirstSibling();AddArt(crest,ReviewMenuArt.Kind.Seal,accent,.7f);
                var statsPanel=Rect("Actual match statistics",right,new Vector2(0,.33f),new Vector2(1,.77f));
                resultStats=statsPanel.gameObject.AddComponent<CanvasGroup>();
                string[] names={"KILLS","DEATHS","ASSISTS","DAMAGE DEALT","DAMAGE TAKEN","MATCH GOLD"};
                string[] values={p.Kills.ToString(),p.Deaths.ToString(),p.Assists.ToString(),p.DamageDealt.ToString("0"),p.DamageTaken.ToString("0"),p.Gold.ToString()};
                for(int i=0;i<6;i++){
                    float x=(i%3)/3f,y=1-(i/3+1)*.5f;
                    var cell=Rect("Result "+names[i],statsPanel,new Vector2(x+.012f,y+.02f),new Vector2(x+1f/3-.012f,y+.48f));
                    var statBg=cell.gameObject.AddComponent<Image>();statBg.color=new Color(.06f,.11f,.15f,.92f);statBg.raycastTarget=false;AddArt(cell,ReviewMenuArt.Kind.Card,accent,.50f);
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
            title.color=Color.white;panelBackground.color=flow!=null?Navy:authored?Color.white:Navy;title.rectTransform.localScale=Vector3.one;
            if(flow!=null&&RenderWizard())return;
            if(view.IsEditorReview&&page==8){AudioPanel();return;}
            if(view.IsEditorReview&&confirmRestart){
                title.text="START A NEW MATCH?";summary.text="The unfinished local match will be discarded.";
                Label("Restart scope",body,new Vector2(.08f,.42f),new Vector2(.92f,.90f),"No BP, permanent XP or Sacred Stone transaction will occur.",25);
                ButtonAt("Keep match",body,new Vector2(.08f,.10f),new Vector2(.47f,.36f),"KEEP CURRENT MATCH",()=>{confirmRestart=false;Rebuild();});
                ButtonAt("Discard match",body,new Vector2(.53f,.10f),new Vector2(.92f,.36f),"START NEW MATCH",()=>{confirmRestart=false;EnterWizard();});return;
            }
            if(view.IsEditorReview&&page==-1){Lobby();return;}
            if(page==0){
                if(view.IsEditorReview&&heroDetail){HeroDetails();return;}
                if(view.IsEditorReview){RenderHeroRoster();return;}
                for(int i=0;i<HeroKitCatalog.All.Count;i++){var kit=HeroKitCatalog.All[i];Cell(i,5,3,(selected==kit.Id?"✓ ":"")+kit.Name,()=>{selected=kit.Id;Rebuild();});}
                Cell(13,5,3,"AI: "+difficulty,()=>{difficulty=(ArenaDifficulty)(((int)difficulty+1)%5);Rebuild();});
                Cell(14,5,3,autoTraining?"AI vs AI":"Play hero",()=>{autoTraining=!autoTraining;Rebuild();});
            }else if(page==1){
                if(flow!=null&&flow.Stage==ReviewMatchStage.Loadout){title.text="BATTLE LOADOUT";summary.text=HeroKitCatalog.Get(selected).Name+" • "+palette+" • Covenant & tactics";}
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
                Cell(0,5,4,"Auto gather",()=>Reply(b.OrderPlayerResource(id,null),"Auto gathering"),working);
                int i=1;foreach(VillageResourceKind kind in Enum.GetValues(typeof(VillageResourceKind))){var k=kind;Cell(i++,5,4,"Gather "+k,()=>Reply(b.OrderPlayerResource(id,k),"Worker assigned to "+k),working);}
                Cell(6,5,4,"Return cargo",()=>Reply(b.OrderPlayerWorker(id,VillageWorkerOrder.Return),"Return ordered"),working);
                Cell(7,5,4,"Hold worker",()=>Reply(b.OrderPlayerWorker(id,VillageWorkerOrder.Hold),"Worker held"),working);
                int j=8;foreach(var kind in new[]{VillageBuildOrder.Depot,VillageBuildOrder.GuardPost,VillageBuildOrder.Farm,VillageBuildOrder.Barracks,VillageBuildOrder.Market,VillageBuildOrder.House}){var k=kind;Cell(j++,5,4,"Build "+k,()=>Reply(b.OrderPlayerConstructionNearBase(k),"Construction queued"),can&&!b.HasConstructionOrder(p.Team));}
                Cell(14,5,4,"Repair lowest HP",()=>Reply(b.OrderPlayerRepairMostDamaged(),"Repair queued"),can&&!b.HasConstructionOrder(p.Team));
                Cell(15,5,4,"Cancel construction",()=>Reply(b.CancelPlayerConstruction(),"Cancelled"),can&&b.HasConstructionOrder(p.Team));
                var builder=b.Units.FirstOrDefault(u=>u.Team==p.Team&&u.Villager?.Job.Effect==VillageEffect.Build);
                Cell(16,5,4,builder?.Construction!=null?builder.Construction.Kind+" "+builder.Construction.Progress.ToString("0.0")+"s":"Builder idle",()=>{},false);
                Cell(17,5,4,"Worker: "+(id??"none"),()=>{int index=System.Array.IndexOf(gatherers,worker);selectedGatherer=gatherers[(index+1)%gatherers.Length].Villager.Job.Id;Rebuild();},gatherers.Length>1);
                Cell(18,5,4,b.RecruitmentPending(p.Team)?"Recruiting (12s)":"Recruit: 20 wood + 30 food",()=>Reply(b.RecruitPlayerGatherer(),"Recruitment queued"),can&&b.CanRecruitPlayerGatherer);
                Cell(19,5,4,"Cancel recruitment",()=>Reply(b.CancelPlayerRecruitment(),"Recruitment cancelled"),can&&b.RecruitmentPending(p.Team));
            }else if(page==4&&b!=null){
                var bank=b.GetVillage(p.Team);summary.text=$"Village gold {bank.Gold:0}  •  Buy 10 units / 15 gold  •  Sell 10 units / 6 gold  •  Living market required";
                int i=0;foreach(var kind in new[]{VillageResourceKind.Wood,VillageResourceKind.Stone,VillageResourceKind.Food,VillageResourceKind.Crystal}){var k=kind;Cell(i++,4,2,"Buy "+k,()=>Reply(b.TradePlayerResource(k,true),"Trade complete"),active);Cell(i++,4,2,"Sell "+k,()=>Reply(b.TradePlayerResource(k,false),"Trade complete"),active);}
            }else if(page==(view.IsEditorReview?7:6)){
                ControlSettingsPage();
            }else if(page==6&&b!=null&&view.IsEditorReview){
                RelicInventory(b);
            }else if(page==5&&b!=null){
                summary.text=$"Damage {p.DamageDealt:0} dealt / {p.DamageTaken:0} taken • Relics {p.Relics.Count} • Nearest visible field targets";
                int i=0;
                var counterTarget=b.PracticeCounterTarget;
                Cell(i++,4,5,b.PracticeCounterUsed?"Practice counter used":counterTarget==null?"No counter target":"Counter "+counterTarget.State.Kit.Name,()=>Reply(counterTarget!=null&&b.TryPracticeCounter(counterTarget.State.Kit.Id,counterTarget.Id),"Practice counter activated; no stone spent"),active&&counterTarget!=null);
                foreach(var u in b.Units.Where(u=>u.Team!=p.Team&&u.State.Alive&&b.IsVisibleTo(p.Team,u)&&Vector2.Distance(p.Position,u.Position)<=p.State.Kit.BasicRange).OrderBy(u=>Vector2.Distance(p.Position,u.Position)).Take(5)){var target=u;Cell(i++,4,5,"Attack "+(u.State.Kit?.Name??u.Kind.ToString()),()=>{Close();b.PlayerAttackUnit(target.Id);},active);}
                foreach(var camp in b.Camps.Where(c=>c.Alive&&b.IsPositionVisibleTo(p.Team,c.Position)&&Vector2.Distance(p.Position,c.Position)<=p.State.Kit.BasicRange).OrderBy(c=>Vector2.Distance(p.Position,c.Position)).Take(3)){var target=camp;Cell(i++,4,5,"Attack "+camp.Kind,()=>{Close();b.AttackNeutralPlayer(target.Id);},active);}
                foreach(var drop in b.Drops.Where(x=>Vector2.Distance(p.Position,x.Position)<=ArenaPickupCatalog.Radius).Take(4)){var target=drop;Cell(i++,4,5,"Pick "+drop.Item.Name,()=>Reply(b.CollectPlayerPickup(target.Id),"Picked up"),active);}
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
        private void Resume(){if(flow!=null&&flow.InWizard){BackWizard();return;}if(Active&&layoutEditor==null&&(!view.IsEditorReview||matchStarted)&&!confirmRestart&&(flow==null||!flow.InWizard&&flow.Stage!=ReviewMatchStage.Startup))Close();}
        private void StartNew(){
            if(starting)return;
            if(flow!=null){
                if(flow.Stage==ReviewMatchStage.Startup||confirmRestart)return;
                if(flow.InWizard){AdvanceWizard();return;}
                if(matchStarted&&Active){confirmRestart=true;Rebuild();return;}
                EnterWizard();return;
            }
            BeginMatch();
        }
        private IEnumerator PrepareReviewMatch(){
            starting=true;view.SetPaused(true);panelGroup.interactable=false;
            Rebuild();
            // Display the exact locked roster before synchronous local initialization.
            yield return null;
            bool ready=false;var previous=view.Battle;bool previouslyStarted=matchStarted;
            try{BeginMatch(false);ready=true;}
            catch(Exception error){Debug.LogException(error);if(!ReferenceEquals(previous,view.Battle))view.AbortReviewMatch();matchStarted=previouslyStarted&&previous!=null&&ReferenceEquals(previous,view.Battle);view.SetPaused(true);flow.FailLoading();page=-1;heroDetail=false;shown=true;panel.gameObject.SetActive(true);Rebuild();feedback.text=matchStarted?"New match failed. Previous match retained; back to lobby to resume.":"Match initialization failed. Review assets and retry.";}
            if(ready){
                title.text="GENESIS RIFT";summary.text="All ten heroes initialized • battlefield ready";
                feedback.text="Local assets ready";ShowVersus(true);
                float hold=0;
                while(hold<.8f){if(Application.isFocused)hold+=Time.unscaledDeltaTime;yield return null;}
                if(authored&&authored.entrance)authored.entrance.Open();
                view.BeginReviewReveal();float elapsed=0,duration=authored&&authored.entrance?ArenaEntranceDoor.Duration:.85f;
                while(elapsed<duration){
                    if(Application.isFocused)elapsed+=Time.unscaledDeltaTime;
                    view.SetReviewReveal(Mathf.Clamp01(elapsed/duration));panelGroup.alpha=1-Mathf.SmoothStep(0,1,elapsed/duration);
                    yield return null;
                }
                if(authored&&authored.entrance&&authored.entrance.IsOpening)authored.entrance.Complete();
                view.EndReviewReveal();flow.CompleteLoading();page=-1;
                if(Application.isFocused){Close();var voice=GetComponent<ReviewHeroDialogue>();if(voice)voice.AnnounceBattleStart();}
                else{shown=true;view.SetPaused(true);Rebuild();}
            }
            panelGroup.alpha=1;starting=false;panelGroup.interactable=true;if(shown)ConfigureWizardControls();
        }
        private void BeginMatch(bool close=true){
            CovenantLoadout? loadout=enableCovenant?new CovenantLoadout(path,first,second,third):(CovenantLoadout?)null;
            view.StartMatch(selected,difficulty,tactic,loadout,autoTraining,seed,!close,flow!=null?palette:ReviewPalette.Original);matchStarted=true;confirmRestart=false;heroDetail=false;evolutionPreviewLevel=1;selectedGatherer=null;lastFinished=false;showResult=false;resultRevealAt=-1;title.rectTransform.localScale=Vector3.one;if(close)Close();else view.SetPaused(true);
        }
        private void Close(){if(showcase)showcase.Hide();if(flow!=null&&flow.Stage!=ReviewMatchStage.InBattle)flow.ResumeBattle();if(view.IsEditorReview){ReviewAudioSettings.Save();var dialogue=GetComponent<ReviewHeroDialogue>();if(dialogue)dialogue.Stop();}shown=false;panel.gameObject.SetActive(false);view.SetPaused(false);}
        private void ApplyResultReveal(){
            float elapsed=resultRevealAt<0?2f:Time.unscaledTime-resultRevealAt;
            float headline=ReviewResultPresentation.Reveal(elapsed,0),stats=ReviewResultPresentation.Reveal(elapsed,.18f),actions=ReviewResultPresentation.Reveal(elapsed,.40f);
            title.rectTransform.localScale=Vector3.one*Mathf.Lerp(.82f,1,headline);
            if(resultEmblem)resultEmblem.localScale=Vector3.one*Mathf.Lerp(.85f,1,headline);
            if(resultStats)resultStats.alpha=stats;
            if(resultActions){resultActions.alpha=actions;resultActions.interactable=actions>.99f;resultActions.blocksRaycasts=actions>.99f;}
        }
        private void Update(){
            if(lastSafe!=MobileBattleInput.SafeArea){ApplySafeArea();if(layoutEditor!=null)layoutEditor.Refresh();}
            if(bodyReveal&&shown){float t=Mathf.Clamp01((Time.unscaledTime-bodyOpened)/.22f);bodyReveal.alpha=Mathf.Lerp(.48f,1,Mathf.SmoothStep(0,1,t));}
            if(starting||layoutEditor!=null)return;
            bool finished=view.Battle!=null&&view.Battle.Finished;
            if(finished&&!lastFinished&&!shown&&view.ShowingCoreCollapse)return;
            if(finished&&!lastFinished&&view.IsEditorReview){showResult=true;resultRevealAt=Time.unscaledTime;}
            if((finished&&!lastFinished)||(!shown&&view.Paused))Open();lastFinished=finished;
            if(shown&&finished&&showResult&&resultRevealAt>=0){
                ApplyResultReveal();if(Time.unscaledTime-resultRevealAt>=.9f)resultRevealAt=-1;
            }
        }
        private void OnApplicationPause(bool paused){if(paused&&view&&view.IsEditorReview)ReviewAudioSettings.Save();}
        private void OnDestroy(){if(view&&view.IsEditorReview)ReviewAudioSettings.Save();if(showcase)Destroy(showcase.gameObject);if(ownedEventSystem)Destroy(ownedEventSystem);}
    }
}
