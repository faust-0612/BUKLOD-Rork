using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    public sealed partial class OfflineSessionMenu {
        ReviewMenuArt AddArt(RectTransform parent,ReviewMenuArt.Kind kind,Color accent,float emphasis){
            var r=Rect("Genesis "+kind,parent,Vector2.zero,Vector2.one);
            var art=r.gameObject.AddComponent<ReviewMenuArt>();art.raycastTarget=false;art.Configure(kind,accent,emphasis);return art;
        }
        void ApplyScreenStyle(){
            bool prep=flow.InWizard,boot=flow.Stage==ReviewMatchStage.Startup;
            bool result=showResult&&view.Battle!=null&&view.Battle.Finished;
            var accent=heroDetail||page==0||flow.Stage==ReviewMatchStage.LockIn?BattleEffects.Accent(selected):NavigationAccent;
            if(backdrop)backdrop.SetAccent(accent);
            if(stageSteps){
                stageSteps.gameObject.SetActive(prep);
                if(prep)stageLine.text=ReviewMenuArt.StepText(flow.Stage);
            }
            if(result)foreach(var tab in navigationTabs)tab.gameObject.SetActive(false);
            if(result){startButton.gameObject.SetActive(false);resumeButton.gameObject.SetActive(false);}
            body.anchorMin=new Vector2(.035f,boot?.14f:result?.075f:.18f);
            body.anchorMax=new Vector2(.965f,boot?.81f:result?.79f:.71f);
            string screen=flow.Stage+":"+page+":"+heroDetail+":"+showResult+":"+confirmRestart;
            if(screen!=lastScreen){bodyOpened=Time.unscaledTime;lastScreen=screen;if(bodyReveal)bodyReveal.alpha=.48f;}
        }
    }
}
