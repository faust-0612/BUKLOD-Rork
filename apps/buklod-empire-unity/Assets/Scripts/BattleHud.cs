using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    public sealed class BattleHud:MonoBehaviour {
        private BattleView view; private MobileBattleInput input;
        private Canvas canvas;private Sprite circle,reviewControl;
        internal Sprite ControlPreviewSprite=>reviewControl?reviewControl:circle;
        private readonly Image[] buttons=new Image[9],cooldown=new Image[9];
        private readonly Text[] labels=new Text[9];
        private Image knob,health,mana;private Text status;
        private Image healthTrack,manaTrack,xpTrack,xp;private Text objective;
        private ReviewMinimap minimap;private readonly ReviewSkillGlyph[] glyphs=new ReviewSkillGlyph[3];
        private OfflineBattle hudMatch;private int lastLevel;private float healthShown,manaShown,xpShown,announcementUntil,nextObjectiveAt;
        private string announcement="";private bool review;
        private int width,height,layoutRevision=-1;private Rect safeArea;private RectTransform infoRoot;
        private Image ImageAt(string name,Transform parent,Color tint){
            var go=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer),typeof(Image));go.transform.SetParent(parent,false);
            var i=go.GetComponent<Image>();i.sprite=circle;i.color=tint;i.raycastTarget=false;return i;
        }
        private Text TextAt(string name,Transform parent){
            var go=new GameObject(name,typeof(RectTransform),typeof(CanvasRenderer),typeof(Text));go.transform.SetParent(parent,false);
            var t=go.GetComponent<Text>();t.font=Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");t.alignment=TextAnchor.MiddleCenter;t.color=Color.white;t.raycastTarget=false;t.horizontalOverflow=HorizontalWrapMode.Overflow;return t;
        }
        private void Awake(){
            view=GetComponent<BattleView>();input=GetComponent<MobileBattleInput>();review=view.IsEditorReview;
            var texture=new Texture2D(64,64,TextureFormat.RGBA32,false);
            for(int y=0;y<64;y++)for(int x=0;x<64;x++){float d=Vector2.Distance(new Vector2(x,y),new Vector2(31.5f,31.5f));texture.SetPixel(x,y,new Color(1,1,1,Mathf.Clamp01(31.5f-d)));}
            texture.Apply();circle=Sprite.Create(texture,new Rect(0,0,64,64),Vector2.one*.5f);
            var go=new GameObject("Mobile HUD",typeof(RectTransform),typeof(Canvas));go.transform.SetParent(transform,false);canvas=go.GetComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.sortingOrder=50;
            for(int i=0;i<buttons.Length;i++){
                buttons[i]=ImageAt("Control "+i,canvas.transform,new Color(.11f,.17f,.23f,.76f));
                if(i==0)continue;
                cooldown[i]=ImageAt("Cooldown",buttons[i].transform,new Color(.02f,.02f,.02f,.8f));cooldown[i].type=Image.Type.Filled;cooldown[i].fillMethod=Image.FillMethod.Radial360;
                labels[i]=TextAt("Label",buttons[i].transform);
            }
            knob=ImageAt("Stick",buttons[0].transform,new Color(.5f,.8f,.7f,.8f));
            status=TextAt("Match status",canvas.transform);
            health=ImageAt("Health",canvas.transform,new Color(.2f,.85f,.38f));health.sprite=null;
            mana=ImageAt("Mana",canvas.transform,new Color(.2f,.55f,.95f));mana.sprite=null;
            if(review)BuildReview();
            infoRoot=new GameObject("Safe HUD information",typeof(RectTransform)).GetComponent<RectTransform>();infoRoot.SetParent(canvas.transform,false);infoRoot.SetAsFirstSibling();
            foreach(var item in new Component[]{healthTrack,manaTrack,xpTrack,health,mana,xp,minimap,status,objective})if(item)item.transform.SetParent(infoRoot,false);
            Layout();
        }
        private static Sprite MakeReviewControl(){
            const int size=128;
            var texture=new Texture2D(size,size,TextureFormat.RGBA32,false);
            texture.name="Review control frame";texture.wrapMode=TextureWrapMode.Clamp;
            var pixels=new Color[size*size];
            for(int y=0;y<size;y++)for(int x=0;x<size;x++){
                float d=Vector2.Distance(new Vector2(x,y),new Vector2(63.5f,63.5f))/63.5f;
                float alpha=Mathf.Clamp01((1-d)*63.5f);
                var fill=Color.Lerp(new Color(.035f,.075f,.105f,.94f),new Color(.13f,.25f,.30f,.94f),y/127f);
                if(d>.82f)fill=Color.Lerp(new Color(.18f,.31f,.34f,.96f),new Color(.76f,.60f,.32f,.98f),Mathf.Clamp01((y/127f)*.8f+.1f));
                if(d>.95f)fill=new Color(.07f,.13f,.16f,.96f);
                fill.a*=alpha;pixels[y*size+x]=fill;
            }
            texture.SetPixels(pixels);texture.Apply(false,true);
            return Sprite.Create(texture,new Rect(0,0,size,size),Vector2.one*.5f);
        }
        private static void ImproveText(Text t){
            var shadow=t.gameObject.AddComponent<Outline>();
            shadow.effectColor=new Color(.015f,.025f,.035f,.95f);
            shadow.effectDistance=new Vector2(1,-1);
            t.color=new Color(.95f,.98f,1);
        }
        private void BuildReview(){
            reviewControl=MakeReviewControl();
            foreach(var button in buttons){button.sprite=reviewControl;button.color=Color.white;}
            foreach(var label in labels)if(label)ImproveText(label);
            ImproveText(status);
            healthTrack=ImageAt("Health track",canvas.transform,new Color(.08f,.13f,.13f,.85f));healthTrack.sprite=null;healthTrack.transform.SetAsFirstSibling();
            manaTrack=ImageAt("Mana track",canvas.transform,new Color(.08f,.13f,.13f,.85f));manaTrack.sprite=null;manaTrack.transform.SetAsFirstSibling();
            xpTrack=ImageAt("Experience track",canvas.transform,new Color(.08f,.13f,.13f,.85f));xpTrack.sprite=null;xpTrack.transform.SetAsFirstSibling();
            xp=ImageAt("Experience",canvas.transform,new Color(.96f,.72f,.28f));xp.sprite=null;
            var mapGo=new GameObject("Fog-safe minimap",typeof(RectTransform),typeof(CanvasRenderer),typeof(ReviewMinimap));
            mapGo.transform.SetParent(canvas.transform,false);minimap=mapGo.GetComponent<ReviewMinimap>();minimap.Bind(view);
            objective=TextAt("Objective status",canvas.transform);objective.horizontalOverflow=HorizontalWrapMode.Wrap;ImproveText(objective);
            for(int i=0;i<3;i++){
                var go=new GameObject("Skill glyph",typeof(RectTransform),typeof(CanvasRenderer),typeof(ReviewSkillGlyph));
                go.transform.SetParent(buttons[i+2].transform,false);go.transform.SetSiblingIndex(0);
                glyphs[i]=go.GetComponent<ReviewSkillGlyph>();glyphs[i].raycastTarget=false;
            }
        }
        private void ReviewLayout(){
            float width=safeArea.width,height=safeArea.height;
            var st=status.rectTransform;st.anchorMin=st.anchorMax=new Vector2(.55f,.94f);st.sizeDelta=new Vector2(width*.63f,height*.065f);
            status.horizontalOverflow=HorizontalWrapMode.Wrap;status.resizeTextForBestFit=true;status.resizeTextMinSize=10;status.resizeTextMaxSize=Mathf.Max(12,(int)(height*.03f));
            var map=minimap.rectTransform;map.anchorMin=new Vector2(.025f,.60f);map.anchorMax=new Vector2(.025f,.60f);map.pivot=Vector2.zero;
            map.anchoredPosition=Vector2.zero;
            float mapWidth=Mathf.Min(width*.18f,height*.31f);
            map.sizeDelta=new Vector2(mapWidth,mapWidth*OfflineBattle.Height/OfflineBattle.Width);
            var o=objective.rectTransform;o.anchorMin=new Vector2(.22f,.84f);o.anchorMax=new Vector2(.78f,.91f);o.offsetMin=o.offsetMax=Vector2.zero;
            objective.fontSize=Mathf.Max(12,(int)(height*.027f));
            foreach(var bar in new[]{healthTrack,manaTrack,xpTrack,xp}){
                var t=bar.rectTransform;t.anchorMin=t.anchorMax=new Vector2(.025f,bar==healthTrack?.94f:bar==manaTrack?.905f:.875f);
                t.pivot=new Vector2(0,.5f);t.anchoredPosition=Vector2.zero;t.sizeDelta=new Vector2(width*.18f,height*(bar==healthTrack?.018f:bar==manaTrack?.013f:.009f));
            }
            for(int i=0;i<3;i++){
                var r=glyphs[i].rectTransform;r.anchorMin=r.anchorMax=new Vector2(.5f,.57f);r.sizeDelta=buttons[i+2].rectTransform.sizeDelta*.72f;
                labels[i+2].rectTransform.anchorMin=labels[i+2].rectTransform.anchorMax=new Vector2(.5f,.18f);
                labels[i+2].rectTransform.sizeDelta=new Vector2(buttons[i+2].rectTransform.sizeDelta.x,buttons[i+2].rectTransform.sizeDelta.y*.32f);
                labels[i+2].fontSize=Mathf.Max(10,(int)(height*.019f));
            }
        }
        static float Fraction(float v,float max)=>Mathf.Clamp01(v/Mathf.Max(.01f,max));
        private void ReviewUpdate(OfflineBattle b){
            var p=b.Player;var s=p.State;bool fresh=hudMatch!=b;
            float h=Fraction(s.Health,s.MaxHealth),m=Fraction(s.Mana,s.MaxMana),x=s.Level>=15?1:Fraction(p.Xp,OfflineBattle.ExperienceThreshold(s.Level));
            if(fresh){hudMatch=b;lastLevel=s.Level;healthShown=h;manaShown=m;xpShown=x;announcement="";announcementUntil=0;nextObjectiveAt=0;for(int i=0;i<3;i++)if(SkillCueCatalog.TryGet(s.Kit.Skill((SkillSlot)i).Id,out var cue))glyphs[i].SetCue(cue,BattleEffects.Accent(s.Kit.Id));}
            if(s.Level>lastLevel){lastLevel=s.Level;announcement="LEVEL "+s.Level+(s.Level==6?"  |  ULTIMATE UNLOCKED":"");announcementUntil=b.Time+2.5f;xpShown=x;nextObjectiveAt=0;}
            float rate=1-Mathf.Exp(-12*Time.unscaledDeltaTime);
            healthShown=Mathf.Lerp(healthShown,h,rate);manaShown=Mathf.Lerp(manaShown,m,rate);xpShown=Mathf.Lerp(xpShown,x,rate);
            health.rectTransform.sizeDelta=new Vector2(safeArea.width*.18f*healthShown,safeArea.height*.018f);
            mana.rectTransform.sizeDelta=new Vector2(safeArea.width*.18f*manaShown,safeArea.height*.013f);
            xp.rectTransform.sizeDelta=new Vector2(safeArea.width*.18f*xpShown,safeArea.height*.009f);
            for(int i=0;i<3;i++)if(cooldown[i+2].fillAmount<=.001f)labels[i+2].text=i==2?"ULT":i==0?"S1":"S2";
            if(b.Time<nextObjectiveAt&&!fresh)return;
            nextObjectiveAt=b.Time+.15f;
            if(b.Time<announcementUntil){objective.text=announcement;objective.color=new Color(1,.82f,.40f);return;}
            objective.color=new Color(.85f,.94f,.91f);
            WildernessCamp nearest=null;float dist=float.PositiveInfinity;
            foreach(var camp in b.Camps){
                if(!camp.Boss||!camp.Alive||!b.IsPositionVisibleTo(p.Team,camp.Position))continue;
                float d=(camp.Position-p.Position).sqrMagnitude;if(d<dist){nearest=camp;dist=d;}
            }
            objective.text=nearest!=null?$"{nearest.Kind}  |  HP {Mathf.CeilToInt(nearest.Health)}/{Mathf.CeilToInt(nearest.MaxHealth)}":$"GENESIS RIFT  |  Relics {p.Relics.Count}  |  Equipment {p.Gear.Count}/6";
        }
        private void Layout(){
            width=Screen.width;height=Screen.height;safeArea=MobileBattleInput.SafeArea;layoutRevision=ArenaControlSettings.Revision;
            infoRoot.anchorMin=Normalized(safeArea.min);infoRoot.anchorMax=Normalized(safeArea.max);infoRoot.offsetMin=infoRoot.offsetMax=Vector2.zero;
            for(int i=0;i<buttons.Length;i++){var t=buttons[i].rectTransform;t.anchorMin=t.anchorMax=Normalized(MobileBattleInput.PixelCenter(i));t.anchoredPosition=Vector2.zero;t.sizeDelta=Vector2.one*MobileBattleInput.Radius(i)*2;
                if(i==0)continue;cooldown[i].rectTransform.sizeDelta=t.sizeDelta;labels[i].rectTransform.sizeDelta=t.sizeDelta;labels[i].fontSize=Mathf.Max(12,(int)(height*.025f));
            }
            knob.rectTransform.sizeDelta=Vector2.one*MobileBattleInput.Radius(0)*.7f;
            var st=status.rectTransform;st.anchorMin=st.anchorMax=new Vector2(.5f,.94f);st.sizeDelta=new Vector2(safeArea.width*.8f,safeArea.height*.06f);status.fontSize=Mathf.Max(15,(int)(safeArea.height*.033f));
            if(review)ReviewLayout();
            foreach(var bar in new[]{health,mana}){var t=bar.rectTransform;t.anchorMin=t.anchorMax=new Vector2(.025f,bar==health?.94f:.905f);t.pivot=new Vector2(0,.5f);t.anchoredPosition=Vector2.zero;}
        }
        private Vector2 Normalized(Vector2 pixel)=>new Vector2(pixel.x/Mathf.Max(1,width),pixel.y/Mathf.Max(1,height));
        private void Update(){
            if(width!=Screen.width||height!=Screen.height||safeArea!=MobileBattleInput.SafeArea||layoutRevision!=ArenaControlSettings.Revision)Layout();
            if(objective)objective.gameObject.SetActive(ArenaControlSettings.DetailedInfo);
            if(minimap)minimap.gameObject.SetActive(ArenaControlSettings.DetailedInfo);
            var stick=buttons[0].rectTransform;stick.anchorMin=stick.anchorMax=Normalized(input.MovementCenter);
            for(int i=1;i<buttons.Length;i++)buttons[i].rectTransform.localScale=Vector3.one*(input.ActiveSkill==i?.92f:1f);
            var b=view.Battle;if(b==null)return;var s=b.Player.State;
            knob.rectTransform.anchoredPosition=input.Joystick*MobileBattleInput.Radius(0)*.6f;
            labels[1].text="ATTACK";cooldown[1].fillAmount=0;
            for(int i=2;i<5;i++){var slot=(SkillSlot)(i-2);float remaining=s.Remaining(slot,b.Time);cooldown[i].fillAmount=slot==SkillSlot.Ultimate&&s.Level<6?1:Mathf.Clamp01(remaining/Mathf.Max(.01f,s.Cooldown(slot,b.Time)));labels[i].text=slot==SkillSlot.Ultimate&&s.Level<6?"LV 6":remaining>0?Mathf.CeilToInt(remaining).ToString():i==4?"ULT":"SKILL "+(i-1);}
            float tacticLeft=Mathf.Max(0,b.Player.TacticReadyAt-b.Time);cooldown[5].fillAmount=tacticLeft/Mathf.Max(1,ArenaTacticalRules.Cooldown(b.Player.Tactic));labels[5].text=tacticLeft>0?Mathf.CeilToInt(tacticLeft).ToString():"TACTIC";
            labels[6].text=b.Player.IsRecalling?Mathf.CeilToInt(b.Player.RecallEnds-b.Time).ToString():"RECALL";cooldown[6].fillAmount=0;
            labels[7].text="MINION";labels[8].text="TOWER";cooldown[7].fillAmount=cooldown[8].fillAmount=0;
            int seconds=Mathf.FloorToInt(b.Time);status.text=b.Finished?(b.Winner.HasValue?(b.Winner.Value==ArenaTeam.Lux?"VICTORY":"DEFEAT"):"DRAW"):$"{seconds/60:00}:{seconds%60:00}  Lv {s.Level}  Gold {b.Player.Gold}  K/D/A {b.Player.Kills}/{b.Player.Deaths}/{b.Player.Assists}  Units {b.RemainingUnits(ArenaTeam.Lux)}:{b.RemainingUnits(ArenaTeam.Tenebra)}";
            health.rectTransform.sizeDelta=new Vector2(safeArea.width*.18f*Mathf.Clamp01(s.Health/s.MaxHealth),safeArea.height*.018f);
            mana.rectTransform.sizeDelta=new Vector2(safeArea.width*.18f*Mathf.Clamp01(s.Mana/Mathf.Max(1,s.MaxMana)),safeArea.height*.013f);
            if(review)ReviewUpdate(b);
        }
        private void OnDestroy(){if(circle){Destroy(circle.texture);Destroy(circle);}if(reviewControl){Destroy(reviewControl.texture);Destroy(reviewControl);}}
    }
}
