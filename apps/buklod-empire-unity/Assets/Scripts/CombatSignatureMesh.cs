using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    internal enum SignatureForm { Cleave, Lance, Fracture, Rampart, Aegis, Dash, Sigil, Wave, Heal, Bolt, Roots, Summon, Contact }
    internal sealed class CombatSignatureMesh {
        internal const int Capacity=12,Strips=4,Segments=32,VertexCount=Strips*(Segments+1)*2;
        readonly GameObject root;readonly Mesh mesh;readonly MeshRenderer renderer;
        readonly Vector3[] vertices=new Vector3[VertexCount];readonly Color[] colors=new Color[VertexCount];
        SignatureForm form;Color tint;float start,duration,size;bool active,ultimate;
        internal CombatSignatureMesh(Transform parent,Material material){
            root=new GameObject("Pooled combat signature geometry");root.transform.SetParent(parent,false);root.layer=parent.gameObject.layer;
            mesh=new Mesh{name="Combat signature ribbon and surface"};mesh.MarkDynamic();
            var indices=new int[Strips*Segments*6];var uv=new Vector2[VertexCount];
            for(int l=0;l<Strips;l++)for(int i=0;i<=Segments;i++){
                int k=(l*(Segments+1)+i)*2;float u=i/(float)Segments;uv[k]=new Vector2(u,0);uv[k+1]=new Vector2(u,1);
                if(i==Segments)continue;int j=(l*Segments+i)*6;
                indices[j]=k;indices[j+1]=k+1;indices[j+2]=k+2;indices[j+3]=k+1;indices[j+4]=k+3;indices[j+5]=k+2;
            }
            mesh.vertices=vertices;mesh.colors=colors;mesh.uv=uv;mesh.triangles=indices;
            root.AddComponent<MeshFilter>().sharedMesh=mesh;renderer=root.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;
            renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;renderer.enabled=false;
        }
        internal static SignatureForm Form(SkillCueShape shape){
            switch(shape){
                case SkillCueShape.Impact:return SignatureForm.Fracture;case SkillCueShape.Wall:return SignatureForm.Rampart;
                case SkillCueShape.Shield:return SignatureForm.Aegis;case SkillCueShape.Dash:return SignatureForm.Dash;
                case SkillCueShape.Mark:return SignatureForm.Sigil;case SkillCueShape.Surge:return SignatureForm.Wave;
                case SkillCueShape.Heal:return SignatureForm.Heal;case SkillCueShape.Bolt:return SignatureForm.Bolt;
                case SkillCueShape.Snare:return SignatureForm.Roots;case SkillCueShape.Summon:return SignatureForm.Summon;
                default:return SignatureForm.Fracture;
            }
        }
        internal static float Envelope(float t,int layer){
            float rise=PremiumMotionEnvelope.Ease(t/(layer==0?.09f:.15f));
            return rise*(1-PremiumMotionEnvelope.Ease((t-(layer==0?.24f:.52f))/(layer==0?.76f:.48f)));
        }
        // Returns the actual two edges of a strip. Broad slashes, barrier panels, dome
        // latitude surfaces, energy spears, forked roots and ground fracture paths.
        internal static void Edges(SignatureForm f,float u,float t,int l,out Vector3 a,out Vector3 b){
            float a0=u*Mathf.PI*2,phase=l*Mathf.PI*.5f;
            float spread=Mathf.Lerp(.30f,1,PremiumMotionEnvelope.Ease(t)),fade=Envelope(t,l);
            float width=.08f+.08f*Mathf.Sin(u*Mathf.PI),r=(.62f+.12f*l)*spread;
            Vector3 p,d;
            switch(f){
                case SignatureForm.Cleave:{
                    float angle=Mathf.Lerp(-1.55f,1.55f,u)+(t-.25f)*.8f;
                    float radius=(.64f+.13f*l)*spread;
                    p=new Vector3(Mathf.Sin(angle)*radius,.55f+.24f*Mathf.Cos(angle)+.07f*l,Mathf.Cos(angle)*radius);
                    d=new Vector3(Mathf.Sin(angle)*(.23f+.025f*l),.12f*Mathf.Sin(Mathf.PI*u),Mathf.Cos(angle)*(.23f+.025f*l));break;
                }
                case SignatureForm.Lance:case SignatureForm.Bolt:{
                    float head=Mathf.Lerp(.18f,1.7f,PremiumMotionEnvelope.Ease(t));
                    float z=Mathf.Lerp(Mathf.Max(0,head-.72f),head,u);
                    p=new Vector3(Mathf.Sin(u*6+phase)*.055f*(1-u),.35f+.05f*l,z);
                    d=new Vector3(Mathf.Cos(phase)*width*(1-u*.88f),Mathf.Sin(phase)*width*(1-u*.88f),0);break;
                }
                case SignatureForm.Fracture:{
                    float angle=phase+.22f*Mathf.Sin(u*18+l);float q=.12f+u*spread;
                    p=new Vector3(Mathf.Cos(angle)*q,.035f+.16f*Mathf.Sin(Mathf.PI*u)*(1-t),Mathf.Sin(angle)*q);
                    d=new Vector3(-Mathf.Sin(angle),.18f,Mathf.Cos(angle))*width*(1-u*.78f);break;
                }
                case SignatureForm.Rampart:{
                    p=new Vector3((u*2-1)*spread,.12f,.24f+(l-1.5f)*.07f);
                    float h=(.48f+.28f*Mathf.Abs(Mathf.Cos(u*Mathf.PI*3)))*spread*fade;
                    a=p;b=p+Vector3.up*h;return;
                }
                case SignatureForm.Aegis:{
                    float theta=Mathf.Lerp(.09f,1.48f,(l+u*.92f)/Strips);
                    float az=a0;
                    p=new Vector3(Mathf.Sin(theta)*Mathf.Cos(az)*spread,Mathf.Cos(theta)*spread*.9f,Mathf.Sin(theta)*Mathf.Sin(az)*spread);
                    float next=theta+.21f;
                    a=p;b=new Vector3(Mathf.Sin(next)*Mathf.Cos(az)*spread,Mathf.Cos(next)*spread*.9f,Mathf.Sin(next)*Mathf.Sin(az)*spread);return;
                }
                case SignatureForm.Dash:
                    p=new Vector3((l-1.5f)*.19f+.10f*Mathf.Sin(u*7+phase),.12f+.22f*u,(u*2-1)*spread);
                    d=new Vector3(width*(1-u*.7f),width*.6f,0);break;
                case SignatureForm.Sigil:
                    {float rr=r*(.66f+.27f*Mathf.Abs(Mathf.Cos(a0*2.5f+phase)));p=new Vector3(Mathf.Cos(a0)*rr,.045f+l*.028f,Mathf.Sin(a0)*rr);d=new Vector3(Mathf.Cos(a0),.1f,Mathf.Sin(a0))*width;break;}
                case SignatureForm.Wave:
                    p=new Vector3((u*2-1)*spread*(.5f+.09f*l),.15f+.24f*Mathf.Sin(u*Mathf.PI),(.3f+t*.8f-l*.15f)*spread);
                    d=new Vector3(0,width*.8f,width*1.6f);break;
                case SignatureForm.Heal:{
                    float angle=a0*1.3f+phase+t*3;float rr=r*(1-u*.45f);
                    p=new Vector3(Mathf.Cos(angle)*rr,.08f+u*.98f*spread,Mathf.Sin(angle)*rr);
                    d=new Vector3(Mathf.Cos(angle),.3f,Mathf.Sin(angle))*width*.75f;break;
                }
                case SignatureForm.Roots:{
                    float angle=phase+.35f*Mathf.Sin(u*8+t*3);float q=(.1f+u*.95f)*spread;
                    p=new Vector3(Mathf.Cos(angle)*q,.055f+Mathf.Sin(Mathf.PI*u)*.40f*spread,Mathf.Sin(angle)*q);
                    d=new Vector3(-Mathf.Sin(angle),.28f,Mathf.Cos(angle))*width*(1-u*.7f);break;
                }
                case SignatureForm.Summon:{
                    float angle=phase+.18f*Mathf.Sin(u*7);float rr=(.32f+.17f*Mathf.Sin(u*Mathf.PI))*spread;
                    p=new Vector3(Mathf.Cos(angle)*rr,u*spread,Mathf.Sin(angle)*rr);
                    d=new Vector3(-Mathf.Sin(angle),0,Mathf.Cos(angle))*width;break;
                }
                default:{
                    float angle=phase+.5f*Mathf.Sin(u*7);float rr=(.1f+u*.8f)*spread;
                    p=new Vector3(Mathf.Cos(angle)*rr,.25f+u*.45f,Mathf.Sin(angle)*rr);
                    d=new Vector3(-Mathf.Sin(angle),.25f,Mathf.Cos(angle))*width*(1-u*.9f);break;
                }
            }
            a=p-d*fade;b=p+d*fade;
        }
        internal void Begin(SignatureForm kind,Vector3 at,Vector3 forward,Color color,float radius,float seconds,bool isUltimate,float now){
            form=kind;tint=color;size=Mathf.Clamp(radius,.08f,5f);duration=Mathf.Clamp(seconds,.12f,1.1f);start=now;ultimate=isUltimate;
            forward.y=0;root.transform.SetPositionAndRotation(at,Quaternion.LookRotation(forward.sqrMagnitude>.001f?forward:Vector3.forward));
            active=true;Tick(now);
        }
        internal void Tick(float now){
            if(!active)return;float t=(now-start)/duration;if(t>=1){Stop();return;}t=Mathf.Clamp01(t);
            for(int l=0;l<Strips;l++)for(int i=0;i<=Segments;i++){
                float u=i/(float)Segments;int k=(l*(Segments+1)+i)*2;
                Edges(form,u,t,l,out var a,out var b);vertices[k]=a*size;vertices[k+1]=b*size;
                var c=Color.Lerp(tint,Color.white,l==0?.66f:.15f);c.a=Envelope(t,l)*(l==0?.85f:.32f)*(ultimate?1f:.78f);
                colors[k]=colors[k+1]=c;
            }
            mesh.vertices=vertices;mesh.colors=colors;mesh.RecalculateBounds();renderer.enabled=true;
        }
        internal void Stop(){active=false;if(renderer)renderer.enabled=false;}
        internal void Dispose(){Stop();if(mesh)Object.Destroy(mesh);if(root)Object.Destroy(root);}
    }
}
