using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    // Original vector skill symbols; geometry is independent of generated portrait art.
    public sealed class ReviewSkillGlyph:MaskableGraphic {
        SkillCueShape shape;int identity=-1;
        public void SetCue(SkillCue cue,Color tint){
            if(identity==cue.Index&&color==tint)return;
            identity=cue.Index;shape=cue.Shape;color=tint;SetVerticesDirty();
        }
        static void Line(VertexHelper v,Vector2 a,Vector2 b,float width,Color32 c){
            if((b-a).sqrMagnitude<.00001f)return;
            var d=(b-a).normalized;var n=new Vector2(-d.y,d.x)*width*.5f;int i=v.currentVertCount;
            v.AddVert(a+n,c,Vector2.zero);v.AddVert(b+n,c,Vector2.zero);v.AddVert(b-n,c,Vector2.zero);v.AddVert(a-n,c,Vector2.zero);
            v.AddTriangle(i,i+1,i+2);v.AddTriangle(i,i+2,i+3);
        }
        protected override void OnPopulateMesh(VertexHelper v){
            v.Clear();var r=GetPixelAdjustedRect();float s=Mathf.Min(r.width,r.height)*.37f;var p=r.center;float w=Mathf.Max(1,s*.13f);
            if(s<=0)return;Color32 c=color;
            void Stroke(float ax,float ay,float bx,float by)=>Line(v,p+new Vector2(ax,ay)*s,p+new Vector2(bx,by)*s,w,c);
            void Ring(int sides,float rad,float phase=0){
                for(int i=0;i<sides;i++){float a=phase+i*2*Mathf.PI/sides,b=phase+(i+1)*2*Mathf.PI/sides;
                    Stroke(Mathf.Cos(a)*rad,Mathf.Sin(a)*rad,Mathf.Cos(b)*rad,Mathf.Sin(b)*rad);}
            }
            switch(shape){
                case SkillCueShape.Heal:Stroke(-.7f,0,.7f,0);Stroke(0,-.7f,0,.7f);break;
                case SkillCueShape.Shield:Stroke(-.7f,.7f,.7f,.7f);Stroke(.7f,.7f,.5f,-.3f);Stroke(.5f,-.3f,0,-.8f);Stroke(0,-.8f,-.5f,-.3f);Stroke(-.5f,-.3f,-.7f,.7f);break;
                case SkillCueShape.Wall:for(int i=-1;i<=1;i++){Stroke(i*.53f,-.7f,i*.53f,.7f);}Stroke(-.85f,-.7f,.85f,-.7f);break;
                case SkillCueShape.Dash:case SkillCueShape.Surge:for(int i=-1;i<=1;i++){float x=i*.42f;Stroke(x-.3f,-.48f,x+.25f,0);Stroke(x+.25f,0,x-.3f,.48f);}break;
                case SkillCueShape.Bolt:Stroke(.35f,.85f,-.35f,.05f);Stroke(-.35f,.05f,.35f,.05f);Stroke(.35f,.05f,-.35f,-.85f);break;
                case SkillCueShape.Mark:Ring(4,.85f);Ring(4,.32f);break;
                case SkillCueShape.Snare:Ring(8,.75f);Stroke(-.55f,-.55f,.55f,.55f);Stroke(-.55f,.55f,.55f,-.55f);break;
                case SkillCueShape.Summon:Ring(6,.78f);Ring(3,.45f,Mathf.PI*.5f);break;
                default:for(int i=0;i<6;i++){float a=i*Mathf.PI/3;Stroke(Mathf.Cos(a)*.26f,Mathf.Sin(a)*.26f,Mathf.Cos(a)*.85f,Mathf.Sin(a)*.85f);}break;
            }
        }
    }
}
