using System.Collections;
using UnityEngine;
using UnityEngine.UI;

namespace Buklod.Empire {
    public sealed partial class OfflineSessionMenu {
        private ReviewMatchFlow pregame;
        private RawImage startupLogo;
        private Texture2D startupAtlas;
        private bool cancelPreparation;

        internal static UnityEngine.Rect StartupFrame(int frame){
            frame=Mathf.Clamp(frame,0,11);
            return new UnityEngine.Rect((frame%4)*.25f,(2-frame/4)/3f,.25f,1f/3f);
        }

        private IEnumerator RevealStartup(){
            float elapsed=0;
            const float frameDuration=.18f;
            float duration=startupAtlas?12*frameDuration:.65f;
            while(elapsed<duration){
                if(Application.isFocused)elapsed+=Mathf.Min(.05f,Time.unscaledDeltaTime);
                if(startupLogo)startupLogo.uvRect=StartupFrame((int)(elapsed/frameDuration));
                float reveal=Mathf.SmoothStep(0,1,elapsed/duration);
                title.rectTransform.localScale=Vector3.one*Mathf.Lerp(.88f,1,reveal);
                yield return null;
            }
            if(pregame.BootReady())Rebuild();
        }

        private void ConfigurePregameControls(){
            if(pregame==null)return;
            var stage=pregame.Stage;
            bool boot=stage==ReviewMatchStage.Startup;
            bool loading=stage==ReviewMatchStage.Loading;
            foreach(var tab in navigationTabs)tab.gameObject.SetActive(!boot&&!pregame.InWizard);
            resumeButton.gameObject.SetActive(!boot&&!confirmRestart);
            startButton.gameObject.SetActive(!boot&&!loading&&!confirmRestart);
            resumeButton.GetComponentInChildren<Text>().text=loading?"CANCEL":pregame.InWizard?"BACK":"RESUME CURRENT MATCH";
            resumeButton.interactable=loading||!starting&&(pregame.InWizard||Active&&matchStarted);
            startButton.GetComponentInChildren<Text>().text=stage==ReviewMatchStage.LockIn?"LOCK IN & START":
                pregame.InWizard?"CONTINUE":"START NEW MATCH";
            startButton.interactable=!starting;
        }

        private void OpenPregame(){
            if(!pregame.Begin())return;
            showResult=false;
            ShowPregameStage();
        }

        private void ShowPregameStage(){
            heroDetail=false;
            evolutionPreviewLevel=1;
            page=pregame.Stage==ReviewMatchStage.Hero?0:pregame.Stage==ReviewMatchStage.Loadout?1:-1;
            feedback.text="";
            Rebuild();
        }

        private void AdvancePregame(){
            if(pregame.Stage==ReviewMatchStage.LockIn&&!ArenaDraftRules.Known(selected))return;
            if(!pregame.Advance())return;
            if(pregame.Stage==ReviewMatchStage.Loading)StartCoroutine(PrepareReviewMatch());
            else ShowPregameStage();
        }

        private bool RenderPregame(){
            switch(pregame.Stage){
                case ReviewMatchStage.Startup:
                    title.text="BUKLOD EMPIRE";
                    title.color=NavigationAccent;
                    summary.text="Genesis: Let There Be Light";
                    if(!startupAtlas)startupAtlas=Resources.Load<Texture2D>("EmpireBrand/StartupLogo");
                    if(startupAtlas){
                        var frame=Rect("BUKLOD Empire animated logo",body,new Vector2(.15f,0),new Vector2(.85f,1));
                        startupLogo=frame.gameObject.AddComponent<RawImage>();
                        startupLogo.texture=startupAtlas;startupLogo.raycastTarget=false;startupLogo.uvRect=StartupFrame(0);
                        var aspect=frame.gameObject.AddComponent<AspectRatioFitter>();
                        aspect.aspectMode=AspectRatioFitter.AspectMode.FitInParent;aspect.aspectRatio=1;
                    }
                    return true;
                case ReviewMatchStage.Mode:
                    title.text="CHOOSE YOUR MODE";
                    summary.text="Genesis Rift • Offline 5v5";
                    Cell(0,2,1,(autoTraining?"":"✓ ")+"PLAY AS HERO",()=>{autoTraining=false;Rebuild();});
                    Cell(1,2,1,(autoTraining?"✓ ":"")+"AI DEMONSTRATION",()=>{autoTraining=true;Rebuild();});
                    return true;
                case ReviewMatchStage.Difficulty:
                    title.text="CHOOSE DIFFICULTY";
                    summary.text=difficulty.ToString();
                    foreach(ArenaDifficulty level in System.Enum.GetValues(typeof(ArenaDifficulty))){
                        Cell((int)level,5,1,(difficulty==level?"✓ ":"")+level,()=>{difficulty=level;Rebuild();});
                    }
                    return true;
                case ReviewMatchStage.Team:
                    title.text="TEAM FORMATION";
                    summary.text="Play from the Lux side";
                    Cell(0,2,1,"LUX • YOUR TEAM",()=>{},false);
                    Cell(1,2,1,"TENEBRA • OPPONENTS",()=>{},false);
                    return true;
                case ReviewMatchStage.Hero:
                    title.text="CHOOSE YOUR HERO";
                    return false;
                case ReviewMatchStage.Loadout:
                    title.text="CONFIGURE LOADOUT";
                    return false;
                case ReviewMatchStage.LockIn:
                case ReviewMatchStage.Loading:
                    bool loading=pregame.Stage==ReviewMatchStage.Loading;
                    title.text=loading?"LOADING GENESIS RIFT":"LUX VS TENEBRA";
                    summary.text=HeroKitCatalog.Get(selected).Name+" • "+difficulty+" • "+tactic;
                    var roster=ArenaDraftRules.PracticeRoster(selected,seed);
                    for(int i=0;i<roster.Length;i++){
                        float left=(i%5)*.2f;
                        float bottom=i<5?.53f:.03f;
                        var label=Label("Roster slot",body,new Vector2(left,bottom),new Vector2(left+.2f,bottom+.44f),
                            HeroKitCatalog.Get(roster[i]).Name+"\n"+(i<5?"LUX":"TENEBRA"),23);
                        label.color=i<5?new Color(.55f,.8f,1):new Color(1,.55f,.48f);
                    }
                    return true;
                default:
                    return false;
            }
        }
    }
}
