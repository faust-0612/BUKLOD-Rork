using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    // Read-only schematic battlefield. Never exposes hidden enemy positions or changes input.
    public sealed class ReviewMinimap:MaskableGraphic {
        BattleView view;
        float nextRefresh;
        public void Bind(BattleView owner){view=owner;raycastTarget=false;SetVerticesDirty();}
        public static Vector2 Normalize(Vector2 p)=>new Vector2(Mathf.Clamp01(p.x/OfflineBattle.Width),Mathf.Clamp01(p.y/OfflineBattle.Height));
        public static bool ShowUnit(OfflineBattle battle,BattleUnit unit)=>unit.State.Alive&&(unit.Team==battle.Player.Team||battle.IsVisibleTo(battle.Player.Team,unit));
        void Update(){
            if(!view||!view.IsEditorReview||Time.unscaledTime<nextRefresh)return;
            nextRefresh=Time.unscaledTime+.15f;SetVerticesDirty();
        }
        Vector2 Point(Rect rect,Vector2 position){
            var uv=Normalize(position);return new Vector2(rect.xMin+uv.x*rect.width,rect.yMin+uv.y*rect.height);
        }
        static void Quad(VertexHelper vh,Vector2 min,Vector2 max,Color32 tint){
            int i=vh.currentVertCount;
            vh.AddVert(new Vector3(min.x,min.y),tint,Vector2.zero);
            vh.AddVert(new Vector3(min.x,max.y),tint,Vector2.zero);
            vh.AddVert(new Vector3(max.x,max.y),tint,Vector2.zero);
            vh.AddVert(new Vector3(max.x,min.y),tint,Vector2.zero);
            vh.AddTriangle(i,i+1,i+2);vh.AddTriangle(i,i+2,i+3);
        }
        static void Triangle(VertexHelper vh,Vector2 a,Vector2 b,Vector2 c,Color32 color){int i=vh.currentVertCount;vh.AddVert(a,color,Vector2.zero);vh.AddVert(b,color,Vector2.zero);vh.AddVert(c,color,Vector2.zero);vh.AddTriangle(i,i+1,i+2);}
        static void Segment(VertexHelper vh,Vector2 a,Vector2 b,float width,Color32 color){var d=(b-a).normalized;var n=new Vector2(-d.y,d.x)*width;Triangle(vh,a-n,a+n,b+n,color);Triangle(vh,a-n,b+n,b-n,color);}
        static void Dot(VertexHelper vh,Vector2 p,float radius,Color32 tint)=>Quad(vh,p-Vector2.one*radius,p+Vector2.one*radius,tint);
        static void Diamond(VertexHelper vh,Vector2 p,float r,Color32 tint){
            int i=vh.currentVertCount;
            vh.AddVert(p+Vector2.up*r,tint,Vector2.zero);vh.AddVert(p+Vector2.right*r,tint,Vector2.zero);
            vh.AddVert(p-Vector2.up*r,tint,Vector2.zero);vh.AddVert(p-Vector2.right*r,tint,Vector2.zero);
            vh.AddTriangle(i,i+1,i+2);vh.AddTriangle(i,i+2,i+3);
        }
        protected override void OnPopulateMesh(VertexHelper vh){
            vh.Clear();if(!view||!view.IsEditorReview||view.Battle==null)return;
            var battle=view.Battle;
            Rect outer=GetPixelAdjustedRect();if(outer.width<12||outer.height<12)return;
            Quad(vh,outer.min,outer.max,new Color32(143,166,158,210));
            var rect=new Rect(outer.xMin+2,outer.yMin+2,outer.width-4,outer.height-4);
            Quad(vh,rect.min,rect.max,new Color32(13,28,27,230));
            float r=Mathf.Max(1.3f,Mathf.Min(rect.width,rect.height)*.016f);
            if(view.UsesSculptedRift){
                var center=Point(rect,SculptedRiftLayout.Center);
                for(int i=0;i<SculptedRiftLayout.BoundarySegments;i++)Triangle(vh,center,Point(rect,SculptedRiftLayout.Boundary(i)),Point(rect,SculptedRiftLayout.Boundary(i+1)),new Color32(37,74,49,255));
                for(int lane=0;lane<3;lane++)for(int i=0;i<40;i++)
                    Segment(vh,Point(rect,SculptedRiftLayout.LanePoint(lane,i,40)),Point(rect,SculptedRiftLayout.LanePoint(lane,i+1,40)),r*.55f,new Color32(173,155,119,220));
                for(int i=0;i<40;i++){float a=1+218*i/40f,b=1+218*(i+1)/40f;
                    Segment(vh,Point(rect,new Vector2(SculptedRiftLayout.RiverX(a),a)),Point(rect,new Vector2(SculptedRiftLayout.RiverX(b),b)),r*.8f,new Color32(52,132,157,240));
                }
            }else{
                foreach(float lane in new[]{.19f,.5f,.81f}){
                    float y=rect.yMin+rect.height*lane;
                    Quad(vh,new Vector2(rect.xMin,y-r*.5f),new Vector2(rect.xMax,y+r*.5f),new Color32(86,107,91,170));
                }
                float river=rect.center.x;
                Quad(vh,new Vector2(river-r,rect.yMin),new Vector2(river+r,rect.yMax),new Color32(43,104,135,190));
            }
            if(battle.Finished)return;
            foreach(var node in battle.ResourceNodes){
                if(node.Stock<=0||node.Team!=battle.Player.Team&&!battle.IsPositionVisibleTo(battle.Player.Team,node.Position))continue;
                Diamond(vh,Point(rect,node.Position),r*.85f,BattleFieldVisuals.ResourceColor(node.Kind));
            }
            if(battle.JungleHazardsActive)foreach(var hazard in battle.JungleHazards)if(battle.IsPositionVisibleTo(battle.Player.Team,hazard.Position))Diamond(vh,Point(rect,hazard.Position),r*2.2f,new Color32(255,65,105,255));
            foreach(var camp in battle.Camps){
                if(!camp.Alive||!battle.IsPositionVisibleTo(battle.Player.Team,camp.Position))continue;
                Diamond(vh,Point(rect,camp.Position),r*(camp.Boss?2:1.15f),new Color32(244,186,83,255));
            }
            foreach(var u in battle.Units){
                if(!ShowUnit(battle,u)||u==battle.Player)continue;
                var tint=u.Team==battle.Player.Team?new Color32(83,189,255,255):new Color32(244,91,101,255);
                var point=Point(rect,u.Position);
                if(u.Kind==BattleTargetKind.Structure)Dot(vh,point,r*(u.Core?2.0f:1.35f),tint);
                else if(u.Kind==BattleTargetKind.Hero)Diamond(vh,point,r*1.45f,tint);
                else Dot(vh,point,r*.6f,tint);
            }
            if(battle.Player.State.Alive)Diamond(vh,Point(rect,battle.Player.Position),r*2.1f,new Color32(244,244,190,255));
        }
    }
}
