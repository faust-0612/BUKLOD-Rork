using UnityEngine;
using UnityEngine.UI;
namespace Buklod.Empire {
    // Original batched vector art. No images fetched, no external art dependencies,
    // no input handlers. Only the background and startup seal animate.
    public sealed class ReviewMenuArt:MaskableGraphic {
        public enum Kind { Backdrop, Card, Button, Seal }
        Kind kind;Color accent;float emphasis=1,phase;float next;
        static readonly Color Ink=new Color(.018f,.032f,.057f,1);
        static readonly Color Gold=new Color(.84f,.70f,.43f,1);
        public void Configure(Kind k,Color a,float e){kind=k;accent=a;emphasis=Mathf.Clamp01(e);raycastTarget=false;SetVerticesDirty();}
        public void SetAccent(Color a){if(accent==a)return;accent=a;SetVerticesDirty();}
        public static string StepText(ReviewMatchStage s){
            string[] labels={"MODE","TEAM","HERO","LOADOUT","LOCK IN","VERSUS"};
            int active=(int)s-(int)ReviewMatchStage.Mode;
            if(active<0||active>=labels.Length)return "";
            for(int i=0;i<labels.Length;i++)labels[i]=(i==active?"◆ ":i<active?"✓ ":"")+labels[i];
            return string.Join("     /     ",labels);
        }
        void Update(){if((kind!=Kind.Backdrop&&kind!=Kind.Seal)||!Application.isFocused||Time.unscaledTime<next)return;next=Time.unscaledTime+.10f;phase=Mathf.Repeat(Time.unscaledTime*.12f,Mathf.PI*2);SetVerticesDirty();}
        static Color Alpha(Color c,float a){c.a=Mathf.Clamp01(a);return c;}
        static void Quad(VertexHelper v,Vector2 a,Vector2 b,Vector2 c,Vector2 d,Color ca,Color cb,Color cc,Color cd){
            int n=v.currentVertCount;v.AddVert(a,ca,Vector2.zero);v.AddVert(b,cb,Vector2.zero);v.AddVert(c,cc,Vector2.zero);v.AddVert(d,cd,Vector2.zero);v.AddTriangle(n,n+1,n+2);v.AddTriangle(n,n+2,n+3);
        }
        static void Tri(VertexHelper v,Vector2 a,Vector2 b,Vector2 c,Color ca,Color cb,Color cc){
            int n=v.currentVertCount;v.AddVert(a,ca,Vector2.zero);v.AddVert(b,cb,Vector2.zero);v.AddVert(c,cc,Vector2.zero);v.AddTriangle(n,n+1,n+2);
        }
        static void Line(VertexHelper v,Vector2 a,Vector2 b,float w,Color c){
            Vector2 delta=b-a;if(delta.sqrMagnitude<.0001f)return;
            var n=new Vector2(-delta.y,delta.x).normalized*w*.5f;Quad(v,a-n,b-n,b+n,a+n,c,c,c,c);
        }
        static Vector2 At(Rect r,float x,float y)=>new Vector2(r.xMin+r.width*x,r.yMin+r.height*y);
        static void Band(VertexHelper v,Vector2 p,float rx,float ry,float start,float end,float w,Color color,int segments){
            for(int i=0;i<segments;i++){float a=Mathf.Lerp(start,end,i/(float)segments),b=Mathf.Lerp(start,end,(i+1)/(float)segments);Line(v,p+new Vector2(Mathf.Cos(a)*rx,Mathf.Sin(a)*ry),p+new Vector2(Mathf.Cos(b)*rx,Mathf.Sin(b)*ry),w,color);}
        }
        static void Facet(VertexHelper v,Vector2 p,float w,float h,Color a){
            var top=p+Vector2.up*h;var right=p+Vector2.right*w;var bottom=p-Vector2.up*h;var left=p-Vector2.right*w;
            Tri(v,top,left,p,Alpha(a,.9f),Alpha(a,.42f),Alpha(Color.white,.85f));Tri(v,top,p,right,Alpha(a,.85f),Alpha(Color.white,.75f),Alpha(a,.65f));
            Tri(v,bottom,right,p,Alpha(a,.38f),Alpha(a,.7f),Alpha(a,.85f));Tri(v,bottom,p,left,Alpha(a,.38f),Alpha(a,.8f),Alpha(a,.55f));
        }
        protected override void OnPopulateMesh(VertexHelper v){
            v.Clear();var r=GetPixelAdjustedRect();if(r.width<1||r.height<1)return;
            float u=Mathf.Max(.5f,Mathf.Min(r.width,r.height)/220f);
            if(kind==Kind.Backdrop){
                var low=Color.Lerp(Ink,accent,.065f);var high=Color.Lerp(Ink,accent,.16f);
                Quad(v,At(r,0,0),At(r,1,0),At(r,1,1),At(r,0,1),Ink,low,high,Ink);
                // Broad translucent diagonal light planes; no particle GameObjects.
                for(int i=0;i<3;i++){float x=.10f+i*.32f+.045f*Mathf.Sin(phase+i*1.7f);var a=At(r,x-.22f,0);var b=At(r,x+.03f,0);var c=At(r,x+.43f,1);var d=At(r,x+.18f,1);Quad(v,a,b,c,d,Alpha(accent,0),Alpha(accent,.028f),Alpha(accent,0),Alpha(accent,.065f));}
                Vector2 center=At(r,.5f,.53f);float radius=r.height*.39f;
                Band(v,center,radius,radius,0,Mathf.PI*2,1*u,Alpha(Gold,.095f),48);
                Band(v,center,radius*1.18f,radius*1.18f,phase,phase+Mathf.PI*1.7f,2*u,Alpha(accent,.12f),40);
                Line(v,At(r,.035f,.875f),At(r,.965f,.875f),u,Alpha(Gold,.50f));
                Line(v,At(r,.035f,.105f),At(r,.965f,.105f),u,Alpha(Gold,.42f));
                for(int side=0;side<2;side++){float x=side==0?.025f:.975f,dir=side==0?1:-1;Line(v,At(r,x,.12f),At(r,x,.87f),u,Alpha(accent,.22f));Line(v,At(r,x,.87f),At(r,x+dir*.06f,.96f),u,Alpha(Gold,.52f));}
                return;
            }
            if(kind==Kind.Seal){
                var center=r.center;float rad=Mathf.Min(r.width,r.height)*.43f;
                for(int i=0;i<48;i++){float a=i*Mathf.PI*2/48,b=(i+1)*Mathf.PI*2/48;Tri(v,center,center+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*rad,center+new Vector2(Mathf.Cos(b),Mathf.Sin(b))*rad,Alpha(accent,.22f),Alpha(accent,0),Alpha(accent,0));}
                Band(v,center,rad,rad,0,Mathf.PI*2,1.5f*u,Alpha(Gold,.85f),64);
                Band(v,center,rad*.82f,rad*.82f,phase,phase+Mathf.PI*1.6f,2*u,Alpha(accent,.7f),48);
                for(int i=0;i<4;i++){float a=i*Mathf.PI*.5f;var p=center+new Vector2(Mathf.Cos(a),Mathf.Sin(a))*rad;Facet(v,p,rad*.038f,rad*.065f,Gold);}
                // Central stylized luminous stone; original emblem, not an approved brand asset.
                Facet(v,center,rad*.39f,rad*.68f,accent);
                Line(v,center+Vector2.up*rad*.63f,center-Vector2.up*rad*.63f,1.2f*u,Alpha(Color.white,.62f));
                return;
            }
            // Chamfered ornamental corners and accent strip on cards/buttons.
            float bevel=Mathf.Min(r.height*.18f,r.width*.10f);
            var fill=Alpha(Color.Lerp(Ink,accent,.12f),kind==Kind.Card?.25f:.10f);
            Quad(v,At(r,0,0),At(r,1,0),At(r,1,1),At(r,0,1),Alpha(Ink,.18f),Alpha(Ink,.18f),fill,fill);
            var edge=Alpha(accent,.26f+.44f*emphasis);var trim=Alpha(Gold,.24f+.48f*emphasis);
            for(int i=0;i<2;i++){float sign=i==0?1:-1;float x=i==0?r.xMin:r.xMax,y=r.yMax;
                var a=new Vector2(x,y-bevel),b=new Vector2(x+sign*bevel,y),c=new Vector2(x+sign*(bevel+r.width*.16f),y);
                Line(v,a,b,1.5f*u,trim);Line(v,b,c,1.5f*u,edge);
                Line(v,new Vector2(x,r.yMin+bevel),new Vector2(x+sign*bevel,r.yMin),u,edge);}
            Line(v,At(r,.19f,.985f),At(r,.81f,.985f),u,Alpha(accent,.38f*emphasis));
            Line(v,At(r,.06f,.02f),At(r,.94f,.02f),u,Alpha(Gold,.32f*emphasis));
        }
    }
}
