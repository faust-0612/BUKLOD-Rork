using UnityEngine;
namespace Buklod.Empire {
    // Visual choreography only. No hit volumes, damage, targeting or physics.
    public static class SkillParticleMotion {
        public const int Count=48;
        public readonly struct Sample {
            public readonly Vector3 Position;public readonly float Size,Opacity,Stretch;
            public Sample(Vector3 position,float size,float opacity,float stretch){Position=position;Size=size;Opacity=opacity;Stretch=stretch;}
        }
        static float Hash(int n){unchecked{uint x=(uint)n*747796405u+2891336453u;x=((x>>((int)(x>>28)+4))^x)*277803737u;x=(x>>22)^x;return (x&65535u)/65535f;}}
        public static Sample Evaluate(SkillCueShape shape,int index,float progress,float radius){
            float t=Mathf.Clamp01(progress),r=Mathf.Max(.1f,radius);
            float q=Hash(index+11),h=Hash(index+91),a=index*2.39996323f;
            float rise=Mathf.Sin(t*Mathf.PI),x=Mathf.Cos(a),z=Mathf.Sin(a);
            float y=.1f,stretch=1,spread=.35f+.65f*t;
            switch(shape){
                case SkillCueShape.Impact:
                    x*=spread*(.7f+.3f*q);z*=spread*(.7f+.3f*q);y=rise*(.08f+.38f*h);stretch=1.35f;break;
                case SkillCueShape.Wall:
                    x=(index%12/11f*2-1)*1.04f;z=.25f+(h-.5f)*.12f;y=(index/12f*.76f+.08f)*rise;stretch=1.5f;break;
                case SkillCueShape.Shield:
                    a+=t*1.7f;x=Mathf.Cos(a)*(.7f+.22f*h);z=Mathf.Sin(a)*(.7f+.22f*h);y=.13f+.62f*q*rise;break;
                case SkillCueShape.Dash:
                    z=-1.1f+(index/(float)(Count-1))*2.3f+t*.45f;x=(q-.5f)*.42f*(1-.5f*t);y=.08f+.28f*h*rise;stretch=2.5f;break;
                case SkillCueShape.Mark:
                    x*=.28f+.35f*q;z*=.28f+.35f*q;y=.06f+.72f*t;stretch=1.25f;break;
                case SkillCueShape.Surge:
                    x*=.38f*spread;z*=1.15f*spread;y=.08f+.30f*rise*h;stretch=1.8f;break;
                case SkillCueShape.Heal:
                    a+=t*3.2f;x=Mathf.Cos(a)*(.45f+.35f*q)*(1-.28f*t);z=Mathf.Sin(a)*(.45f+.35f*q)*(1-.28f*t);y=.12f+t*(.45f+.42f*h);break;
                case SkillCueShape.Bolt:
                    z=.1f+1.45f*t+(q-.5f)*.65f;x=(h-.5f)*.38f*(1-.5f*t);y=.12f+.18f*rise;stretch=2.9f;break;
                case SkillCueShape.Snare:
                    float vine=.75f+.17f*Mathf.Sin(a*7+t*4);x*=vine*spread;z*=vine*spread;y=.1f+rise*h*.45f;stretch=1.5f;break;
                case SkillCueShape.Summon:
                    a-=t*2.1f;float gear=.64f+.16f*Mathf.Cos(a*8);x=Mathf.Cos(a)*gear;z=Mathf.Sin(a)*gear;y=.06f+.58f*q*rise;break;
            }
            float alpha=rise*(.6f+.4f*h);
            float size=r*(.035f+.044f*q)*(1+.4f*rise);
            return new Sample(new Vector3(x,y,z)*r,size,alpha,stretch);
        }
    }
}
