using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    public sealed partial class OfflineSessionMenu {
        ReviewMatchFlow flow;ReviewHeroShowcase showcase;string startupError;bool booting;
        string[] lockedRoster;ReviewPalette palette;int roleFilter;
        IEnumerator BootReview(){
            if(booting)yield break;booting=true;startupError=null;Rebuild();yield return null;
            try{
                if(!view.visuals||!view.battleCamera)throw new InvalidOperationException("Missing local presentation catalog.");
#if UNITY_EDITOR || BUKLOD_OFFLINE_REVIEW
                view.visuals.ValidateOfflineReview();
#endif
                // Transition to lobby only after the readiness reveal.
            }catch(Exception error){startupError="Local assets unavailable. Retry after preparing the review assets.";Debug.LogException(error);}
            if(startupError==null){
                // Animate the branding after real asset validation, not a fake progress counter.
                float elapsed=0;summary.text="Local assets ready";
                while(elapsed<.65f){if(Application.isFocused)elapsed+=Time.unscaledDeltaTime;title.rectTransform.localScale=Vector3.one*Mathf.Lerp(.88f,1,Mathf.SmoothStep(0,1,elapsed/.65f));yield return null;}
            }
            if(startupError==null)flow.BootReady();booting=false;Rebuild();
        }
        bool ShowModel(RectTransform parent,string hero,bool face,Vector2 min,Vector2 max,bool wings=false){
            if(flow==null)return false;
            try{
                if(!showcase){var go=new GameObject("Live pre-match showcase");go.transform.SetParent(transform,false);showcase=go.AddComponent<ReviewHeroShowcase>();showcase.Initialize(view);}
                bool ok=hero==null?showcase.ShowMap():showcase.ShowHero(hero,face,palette,wings);
                if(!ok){showcase.Hide();return false;}
                var r=Rect("Live model render",parent,min,max);
                var raw=r.gameObject.AddComponent<RawImage>();raw.texture=showcase.Texture;raw.raycastTarget=false;
                var fit=r.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=1;
                return true;
            }catch(Exception error){
                Debug.LogWarning("Review showcase unavailable: "+error.GetType().Name);
                if(showcase){showcase.Hide();Destroy(showcase.gameObject);showcase=null;}
                return false;
            }
        }
        void EnterWizard(){if(!flow.Begin())return;showResult=false;heroDetail=false;evolutionPreview=false;confirmRestart=false;lockedRoster=null;page=-1;feedback.text="";Rebuild();}
        void AdvanceWizard(){
            if(flow==null||!flow.InWizard||starting)return;
            if(flow.Stage==ReviewMatchStage.LockIn){
                if(!ArenaDraftRules.Known(selected))return;
                lockedRoster=ArenaDraftRules.PracticeRoster(selected,seed);
                StartCoroutine(LockAndPrepare());return;
            }
            if(!flow.Advance())return;
            SyncWizardPage();Rebuild();
        }
        IEnumerator LockAndPrepare(){
            starting=true;panelGroup.interactable=false;view.SetPaused(true);
            foreach(Transform child in body){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            title.text=HeroKitCatalog.Get(selected).Name.ToUpperInvariant()+" • LOCKED IN";title.color=BattleEffects.Accent(selected);summary.text="Lux formation confirmed";
            var frame=Rect("Locked hero showcase",body,new Vector2(.15f,.01f),new Vector2(.85f,.99f));
            if(ShowModel(frame,selected,false,Vector2.zero,Vector2.one))showcase.PlayEntrance();
            else Label("Locked hero name",frame,Vector2.zero,Vector2.one,HeroKitCatalog.Get(selected).Name,46);
            var dialogue=GetComponent<ReviewHeroDialogue>();feedback.text=dialogue?dialogue.Select(selected):"Offline practice";
            float elapsed=0;while(elapsed<.9f){if(Application.isFocused)elapsed+=Time.unscaledDeltaTime;yield return null;}
            if(flow.Advance())yield return PrepareReviewMatch();else{starting=false;panelGroup.interactable=true;Rebuild();}
        }
        void BackWizard(){if(!flow.Back())return;lockedRoster=null;SyncWizardPage();Rebuild();}
        void SyncWizardPage(){heroDetail=false;evolutionPreview=false;page=flow.Stage==ReviewMatchStage.Hero?0:flow.Stage==ReviewMatchStage.Loadout?1:-1;feedback.text="";}
        void ConfigureWizardControls(){
            bool wizard=flow.InWizard,boot=flow.Stage==ReviewMatchStage.Startup;
            foreach(var tab in navigationTabs)tab.gameObject.SetActive(!wizard&&!boot);
            resumeButton.gameObject.SetActive(!boot&&flow.Stage!=ReviewMatchStage.Loading);
            resumeButton.GetComponentInChildren<Text>().text=wizard?"BACK":"RESUME CURRENT MATCH";
            resumeButton.interactable=wizard||Active&&matchStarted&&!confirmRestart;
            startButton.gameObject.SetActive(!boot&&flow.Stage!=ReviewMatchStage.Loading);
            startButton.GetComponentInChildren<Text>().text=flow.Stage==ReviewMatchStage.Mode?"CONTINUE":flow.Stage==ReviewMatchStage.Team?"CHOOSE HERO":flow.Stage==ReviewMatchStage.Hero?"CONFIRM HERO":flow.Stage==ReviewMatchStage.Loadout?"REVIEW TEAM":flow.Stage==ReviewMatchStage.LockIn?"LOCK IN & START":"PLAY";
            startButton.interactable=!starting;
        }
        void RenderHeroRoster(){
            title.text="CHOOSE YOUR HERO";summary.text=(flow.Stage==ReviewMatchStage.Hero?"03 / 04  •  ":"")+"13 original heroes • Preview motion, skills & practice palettes";
            var names=new[]{"ALL HEROES","CLOSE RANGE","RANGED"};
            for(int i=0;i<3;i++){int filter=i;var button=ButtonAt(names[i],body,new Vector2(.01f+i*.33f,.84f),new Vector2(.32f+i*.33f,.99f),(roleFilter==i?"✓ ":"")+names[i],()=>{roleFilter=filter;Rebuild();});if(roleFilter==i)button.GetComponentInChildren<Text>().color=NavigationAccent;}
            int index=0;foreach(var kit in HeroKitCatalog.All){if(roleFilter==1&&kit.BasicRange>=8f||roleFilter==2&&kit.BasicRange<8f)continue;HeroCard(index++,kit);}
        }
        bool RenderWizard(){
            switch(flow.Stage){
                case ReviewMatchStage.Startup:
                    title.text="BUKLOD EMPIRE";title.color=NavigationAccent;summary.text="GENESIS • LET THERE BE LIGHT";
                    Label("Startup brand",body,new Vector2(.08f,.28f),new Vector2(.92f,.95f),"E M P I R E",58);
                    Label("Boot status",body,new Vector2(.08f,.08f),new Vector2(.92f,.28f),startupError??"Checking local arena and hero assets…",21);
                    if(startupError!=null)ButtonAt("Retry",body,new Vector2(.32f,0),new Vector2(.68f,.12f),"RETRY",()=>StartCoroutine(BootReview()));
                    return true;
                case ReviewMatchStage.Mode:
                    title.text="CHOOSE YOUR BATTLE";summary.text="01 / 04  •  Genesis Rift  •  Offline";
                    var mapFrame=Rect("Map showcase",body,new Vector2(.015f,.02f),new Vector2(.52f,.98f));
                    if(!ShowModel(mapFrame,null,false,Vector2.zero,Vector2.one))Label("Map fallback",mapFrame,Vector2.zero,Vector2.one,"Genesis Rift preview unavailable",22);
                    var info=Rect("Mode information",body,new Vector2(.54f,.02f),new Vector2(.99f,.98f));
                    Label("Mode",info,new Vector2(0,.72f),Vector2.one,"GENESIS RIFT • 5v5",32);
                    Label("Objectives",info,new Vector2(0,.50f),new Vector2(1,.72f),"Three lanes • village economy • wilderness camps\nBreak the fortress and defeat remaining heroes",20);
                    ButtonAt("Difficulty",info,new Vector2(0,.30f),new Vector2(1,.48f),"DIFFICULTY: "+difficulty,()=>{difficulty=(ArenaDifficulty)(((int)difficulty+1)%5);Rebuild();});
                    ButtonAt("Mode type",info,new Vector2(0,.10f),new Vector2(1,.28f),autoTraining?"AI DEMONSTRATION":"PLAY AS HERO",()=>{autoTraining=!autoTraining;Rebuild();});
                    return true;
                case ReviewMatchStage.Team:
                    title.text="ASSEMBLE YOUR TEAM";summary.text="02 / 04  •  Local AI teammates and opponents";
                    Label("Lux",body,new Vector2(.03f,.78f),new Vector2(.48f,1),"LUX",30).color=new Color(.45f,.75f,1);
                    Label("Tenebra",body,new Vector2(.52f,.78f),new Vector2(.97f,1),"TENEBRA",30).color=new Color(1,.42f,.38f);
                    for(int i=0;i<5;i++){
                        float top=.77f-i*.145f;
                        Label("Lux slot "+i,body,new Vector2(.03f,top-.13f),new Vector2(.48f,top),i==0?(autoTraining?"AI featured hero":"YOU • choose your hero"):"AI ALLY "+i,22);
                        Label("Tenebra slot "+i,body,new Vector2(.52f,top-.13f),new Vector2(.97f,top),"AI OPPONENT "+(i+1),22);
                    }
                    return true;
                case ReviewMatchStage.Hero: return false;
                case ReviewMatchStage.Loadout: return false;
                case ReviewMatchStage.LockIn:
                    title.text="CONFIRM YOUR HERO";summary.text="04 / 04  •  "+HeroKitCatalog.Get(selected).Name+"  •  "+palette+"  •  "+difficulty+"  •  "+tactic;
                    lockedRoster=ArenaDraftRules.PracticeRoster(selected,seed);
                    ShowVersus(false);
                    feedback.text="Offline practice • no Sacred Stone spent • no account reward";return true;
                case ReviewMatchStage.Loading:
                    title.text="LUX  VS  TENEBRA";summary.text="Initializing the locked local roster…";
                    ShowVersus(false);return true;
                default:return false;
            }
        }
        void ShowVersus(bool ready){
            foreach(Transform child in body){child.gameObject.SetActive(false);Destroy(child.gameObject);}
            if(lockedRoster==null||lockedRoster.Length!=10)return;
            for(int i=0;i<10;i++){
                bool lux=i<5;var kit=HeroKitCatalog.Get(lockedRoster[i]);float x=(i%5)/5f;
                float bottom=lux?.52f:.02f,top=lux?.98f:.48f;
                var cell=Rect("Locked "+kit.Id,body,new Vector2(x+.012f,bottom),new Vector2(x+.188f,top));
                var bg=cell.gameObject.AddComponent<Image>();bg.color=Color.Lerp(Navy,BattleEffects.Accent(kit.Id),.25f);bg.raycastTarget=false;
                var portrait=reviewPortraits?reviewPortraits.Find(kit.Id,true):null;
                if(portrait){
                    var r=Rect("Hero portrait",cell,new Vector2(.04f,.24f),new Vector2(.96f,.95f));var raw=r.gameObject.AddComponent<RawImage>();raw.texture=portrait;raw.raycastTarget=false;
                    var fit=r.gameObject.AddComponent<AspectRatioFitter>();fit.aspectMode=AspectRatioFitter.AspectMode.FitInParent;fit.aspectRatio=(float)portrait.width/portrait.height;
                }
                var name=Label("Hero",cell,new Vector2(.01f,.10f),new Vector2(.99f,.28f),kit.Name,22);name.color=BattleEffects.Accent(kit.Id);
                Label("Ready",cell,Vector2.zero,new Vector2(1,.11f),(lux?"LUX":"TENEBRA")+" • "+(i==0&&!autoTraining?"YOU":"AI")+(ready?" • READY":""),13);
            }
        }
    }
}
