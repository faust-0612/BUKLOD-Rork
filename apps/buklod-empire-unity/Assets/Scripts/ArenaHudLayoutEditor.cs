using System;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace Buklod.Empire {
    // In-game placement editor: renders the real saved control geometry over the paused match.
    // Only a completed drag or explicit size/reset action writes device preferences.
    internal sealed class ArenaHudLayoutEditor {
        static readonly string[] Names={"MOVE","ATK","S1","S2","ULT","TACTIC","RECALL","MINION","TOWER"};
        readonly RectTransform root;
        readonly RectTransform[] handles=new RectTransform[9];
        readonly Image[] images=new Image[9];
        readonly Font font;
        readonly Text message;
        int selected;
        bool dragging;
        public ArenaHudLayoutEditor(RectTransform parent,Font labelFont,Sprite controlSprite,Action close){
            font=labelFont;
            root=Rect("HUD layout editor",parent,Vector2.zero,Vector2.one);
            var backdrop=root.gameObject.AddComponent<Image>();backdrop.color=new Color(.035f,.065f,.09f,.66f);
            var bar=Rect("Layout toolbar",root,new Vector2(0,.70f),Vector2.one);
            bar.gameObject.AddComponent<Image>().color=new Color(.035f,.065f,.09f,.98f);
            message=Text("Selected",bar,new Vector2(.02f,.49f),new Vector2(.98f,.98f),"",23);
            MakeButton(bar,0,"SIZE −",()=>Resize(-.1f));
            MakeButton(bar,1,"SIZE +",()=>Resize(.1f));
            MakeButton(bar,2,"RESET",()=>{ArenaControlSettings.Reset();Refresh();});
            MakeButton(bar,3,"DONE",()=>{root.gameObject.SetActive(false);UnityEngine.Object.Destroy(root.gameObject);close();});
            for(int i=0;i<handles.Length;i++){
                int index=i;
                var item=Rect("Drag "+Names[i],root,Vector2.zero,Vector2.zero);
                handles[i]=item;
                var image=item.gameObject.AddComponent<Image>();image.sprite=controlSprite;images[i]=image;
                Text("Control label",item,Vector2.zero,Vector2.one,Names[i],18);
                var events=item.gameObject.AddComponent<EventTrigger>();
                Add(events,EventTriggerType.PointerDown,e=>{selected=index;Highlight();});
                Add(events,EventTriggerType.BeginDrag,e=>{selected=index;dragging=true;Highlight();});
                Add(events,EventTriggerType.Drag,e=>{if(dragging&&selected==index)Preview(index,e.position);});
                Add(events,EventTriggerType.EndDrag,e=>{
                    if(!dragging||selected!=index)return;
                    dragging=false;
                    var area=MobileBattleInput.SafeArea;
                    var delta=e.position-ArenaControlSettings.Center(area,index);
                    bool ok=ArenaControlSettings.Adjust(index,new Vector2(delta.x/area.width,delta.y/area.height),0,area);
                    Refresh();if(!ok)message.text="Cannot overlap another control. Try another position.";
                });
            }
            Refresh();
        }
        static RectTransform Rect(string name,Transform parent,Vector2 min,Vector2 max){
            var r=new GameObject(name,typeof(RectTransform)).GetComponent<RectTransform>();r.SetParent(parent,false);
            r.anchorMin=min;r.anchorMax=max;r.offsetMin=r.offsetMax=Vector2.zero;return r;
        }
        Text Text(string name,Transform parent,Vector2 min,Vector2 max,string value,int size){
            var t=Rect(name,parent,min,max).gameObject.AddComponent<Text>();t.font=font;t.text=value;t.fontSize=size;
            t.resizeTextForBestFit=true;t.resizeTextMinSize=10;t.resizeTextMaxSize=size;t.color=Color.white;
            t.alignment=TextAnchor.MiddleCenter;t.raycastTarget=false;return t;
        }
        void MakeButton(RectTransform bar,int index,string title,Action action){
            float x=index*.25f;
            var r=Rect(title,bar,new Vector2(x+.01f,.07f),new Vector2(x+.24f,.48f));
            var image=r.gameObject.AddComponent<Image>();image.color=new Color(.13f,.30f,.32f,1);
            var b=r.gameObject.AddComponent<Button>();b.targetGraphic=image;b.onClick.AddListener(()=>action());
            Text("Label",r,Vector2.zero,Vector2.one,title,21);
        }
        static void Add(EventTrigger trigger,EventTriggerType type,Action<PointerEventData> callback){
            var entry=new EventTrigger.Entry{eventID=type};
            entry.callback.AddListener(data=>{if(data is PointerEventData pointer)callback(pointer);});
            trigger.triggers.Add(entry);
        }
        void Preview(int i,Vector2 pixel){
            var area=MobileBattleInput.SafeArea;
            float radius=ArenaControlSettings.Radius(area,i);
            var at=ArenaTouchLayout.ClampCenter(area,pixel,radius);
            at.y=Mathf.Min(at.y,area.yMin+area.height*.65f-radius);
            handles[i].anchorMin=handles[i].anchorMax=new Vector2((at.x-area.xMin)/area.width,(at.y-area.yMin)/area.height);
            handles[i].anchoredPosition=Vector2.zero;
        }
        void Resize(float change){
            bool ok=ArenaControlSettings.Adjust(selected,Vector2.zero,change,MobileBattleInput.SafeArea);
            Refresh();if(!ok)message.text="Not enough space for that size.";
        }
        void Highlight(){
            for(int i=0;i<images.Length;i++)images[i].color=i==selected?new Color(1,.85f,.48f,1):new Color(.85f,.92f,1,.86f);
            message.text=Names[selected]+"  •  "+ArenaControlSettings.Scale(selected).ToString("P0")+"  •  Drag to move";
        }
        public void Refresh(){
            dragging=false;
            Canvas.ForceUpdateCanvases();
            var area=MobileBattleInput.SafeArea;
            for(int i=0;i<handles.Length;i++){
                Preview(i,ArenaControlSettings.Center(area,i));
                float diameter=ArenaControlSettings.Radius(area,i)*2*root.rect.width/Mathf.Max(1,area.width);
                handles[i].sizeDelta=Vector2.one*diameter;
            }
            Highlight();
        }
    }
}
