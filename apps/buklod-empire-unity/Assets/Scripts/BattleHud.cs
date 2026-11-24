using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    public sealed class BattleHud:MonoBehaviour {
        private BattleView view; private MobileBattleInput input;
        private Canvas canvas;private Sprite circle;
        private readonly Image[] buttons=new Image[6],cooldown=new Image[6];
        private readonly Text[] labels=new Text[6];
        private Image knob,health,mana;private Text status,target;
        private int width,height;
        private Image ImageAt(string name,Transform parent,Color tint){
            var go=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer),typeof(Image));go.transform.SetParent(parent,false);
            var i=go.GetComponent<Image>();i.sprite=circle;i.color=tint;i.raycastTarget=false;return i;
        }
        private Text TextAt(string name,Transform parent){
            var go=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer),typeof(Text));go.transform.SetParent(parent,false);
            var t=go.GetComponent<Text>();t.font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");t.alignment=TextAnchor.MiddleCenter;t.color=Color.white;t.raycastTarget=false;t.horizontalOverflow=HorizontalWrapMode.Overflow;return t;
        }
        private void Awake(){
            view=GetComponent<BattleView>();input=GetComponent<MobileBattleInput>();
            var texture=new Texture2D(64,64,TextureFormat.RGBA32,false);
            for(int y=0;y<64;y++)for(int x=0;x<64;x++){float d=Vector2.Distance(new Vector2(x,y),new Vector2(31.5f,31.5f));texture.SetPixel(x,y,new Color(1,1,1,Mathf.Clamp01(31.5f-d)));}
            texture.Apply();circle=Sprite.Create(texture,new Rect(0,0,64,64),Vector2.one*.5f);
            var go=new GameObject("Mobile HUD",typeof(RectTransform),typeof(Canvas));go.transform.SetParent(transform,false);canvas=go.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=50;
            for(int i=0;i<6;i++){
                buttons[i]=ImageAt("Control "+i,canvas.transform,new Color(.11f,.17f,.23f,.76f));
                if(i==0)continue;
                cooldown[i]=ImageAt("Cooldown",buttons[i].transform,new Color(.02f,.02f,.02f,.8f));cooldown[i].type=Image.Type.Filled;cooldown[i].fillMethod=Image.FillMethod.Radial360;
                labels[i]=TextAt("Label",buttons[i].transform);
            }
            knob=ImageAt("Stick",buttons[0].transform,new Color(.5f,.8f,.7f,.8f));
            status=TextAt("Match status",canvas.transform);target=TextAt("Target lock",canvas.transform);
            health=ImageAt("Health",canvas.transform,new Color(.2f,.85f,.38f));health.sprite=null;
            mana=ImageAt("Mana",canvas.transform,new Color(.2f,.55f,.95f));mana.sprite=null;
            Layout();
        }
        private void Layout(){
            width=Screen.width;height=Screen.height;
            for(int i=0;i<6;i++){var t=buttons[i].rectTransform;t.anchorMin=t.anchorMax=MobileBattleInput.Centers[i];t.anchoredPosition=Vector2.zero;t.sizeDelta=Vector2.one*MobileBattleInput.Radius(i)*2;
                if(i==0)continue;cooldown[i].rectTransform.sizeDelta=t.sizeDelta;labels[i].rectTransform.sizeDelta=t.sizeDelta;labels[i].fontSize=Mathf.Max(12,(int)(height*.025f));
            }
            knob.rectTransform.sizeDelta=Vector2.one*MobileBattleInput.Radius(0)*.7f;
            var st=status.rectTransform;st.anchorMin=st.anchorMax=new Vector2(.5f,.94f);st.sizeDelta=new Vector2(width*.8f,height*.06f);status.fontSize=Mathf.Max(15,(int)(height*.033f));
            var lockRect=target.rectTransform;lockRect.anchorMin=lockRect.anchorMax=new Vector2(.5f,.84f);lockRect.sizeDelta=new Vector2(width*.4f,height*.05f);target.fontSize=Mathf.Max(12,(int)(height*.023f));
            foreach(var bar in new[]{health,mana}){var t=bar.rectTransform;t.anchorMin=t.anchorMax=new Vector2(.025f,bar==health?.94f:.905f);t.pivot=new Vector2(0,.5f);t.anchoredPosition=Vector2.zero;}
        }
        private void Update(){
            if(width!=Screen.width||height!=Screen.height)Layout();
            var b=view.Battle;if(b==null)return;var s=b.Player.State;
            knob.rectTransform.anchoredPosition=input.Joystick*MobileBattleInput.Radius(0)*.6f;
            labels[1].text="ATTACK";cooldown[1].fillAmount=0;
            for(int i=2;i<5;i++){var slot=(SkillSlot)(i-2);float remaining=s.Remaining(slot,b.Time);cooldown[i].fillAmount=slot==SkillSlot.Ultimate&&s.Level<6?1:Mathf.Clamp01(remaining/Mathf.Max(.01f,s.Cooldown(slot,b.Time)));labels[i].text=slot==SkillSlot.Ultimate&&s.Level<6?"LV 6":remaining>0?Mathf.CeilToInt(remaining).ToString():i==4?"ULT":"SKILL "+(i-1);}
            float tacticLeft=Mathf.Max(0,b.Player.TacticReadyAt-b.Time);cooldown[5].fillAmount=Mathf.Clamp01(tacticLeft/ArenaTacticalRules.Cooldown(b.Player.Tactic));labels[5].text=tacticLeft>0?Mathf.CeilToInt(tacticLeft).ToString():"TACTIC";
            int seconds=Mathf.FloorToInt(b.Time);status.text=b.Finished?(b.Winner.HasValue?(b.Winner.Value==ArenaTeam.Lux?"VICTORY":"DEFEAT"):"DRAW"):$"{seconds/60:00}:{seconds%60:00}   Lv {s.Level}   Gold {b.Player.Gold}   {b.Player.Kills}/{b.Player.Deaths}/{b.Player.Assists}   L {b.RemainingUnits(ArenaTeam.Lux)} : T {b.RemainingUnits(ArenaTeam.Tenebra)}";
            target.text=b.Finished?ArenaProgression.TrainingResult(true):string.IsNullOrEmpty(view.TargetLabel)?"":"TARGET: "+view.TargetLabel;
            health.rectTransform.sizeDelta=new Vector2(width*.18f*Mathf.Clamp01(s.Health/s.MaxHealth),height*.018f);
            mana.rectTransform.sizeDelta=new Vector2(width*.18f*Mathf.Clamp01(s.Mana/Mathf.Max(1,s.MaxMana)),height*.013f);
        }
        private void OnDestroy(){if(circle){Destroy(circle.texture);Destroy(circle);}}
    }
}
