using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    // Pooled 3D energy sheets, not lines or simulated hitboxes. One mesh per cast, three
    // overlapping ribbons, depth-tested against the world. All coordinates are local.
    internal sealed class PremiumSkillSurface {
        internal const int Segments=40,Layers=3,VertexCount=Layers*(Segments+1)*2;
        readonly GameObject root;readonly Mesh mesh;readonly MeshRenderer renderer;
        readonly Vector3[] vertices=new Vector3[VertexCount];
        readonly Color[] colors=new Color[VertexCount];
        readonly Vector2[] uv=new Vector2[VertexCount];
        SkillCue cue;CinematicSkillProfile profile;Color tint;float start;bool active;
        public PremiumSkillSurface(Transform parent,Material material){
            root=new GameObject("Cinematic energy surfaces");root.transform.SetParent(parent,false);root.layer=parent.gameObject.layer;
            mesh=new Mesh{name="Pooled cinematic skill surface"};mesh.MarkDynamic();
            var indices=new int[Layers*Segments*6];
            for(int layer=0;layer<Layers;layer++)for(int i=0;i<=Segments;i++){
                int v=(layer*(Segments+1)+i)*2;uv[v]=new Vector2((float)i/Segments,0);uv[v+1]=new Vector2((float)i/Segments,1);
                if(i==Segments)continue;int j=(layer*Segments+i)*6;
                indices[j]=v;indices[j+1]=v+1;indices[j+2]=v+2;indices[j+3]=v+1;indices[j+4]=v+3;indices[j+5]=v+2;
            }
            mesh.vertices=vertices;mesh.uv=uv;mesh.colors=colors;mesh.triangles=indices;
            root.AddComponent<MeshFilter>().sharedMesh=mesh;renderer=root.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;
            renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;renderer.enabled=false;
        }
        public void Begin(Vector3 origin,Color color,SkillCue skill,CinematicSkillProfile motif,Vector3 forward,float now){
            cue=skill;profile=motif;tint=color;start=now;root.transform.position=origin;
            forward.y=0;root.transform.rotation=Quaternion.LookRotation(forward.sqrMagnitude>.001f?forward:Vector3.forward);
            active=true;Tick(now);
        }
        // Shape-specific silhouettes: upright barrier sails, curved surge ribbons, rising
        // dome meridians, angular earth fractures, helical healing and constellation webs.
        internal static Vector3 Sample(CinematicSkillProfile p,float u,float t,int layer){
            float a=u*Mathf.PI*2,spread=Mathf.Lerp(.22f,1,PremiumMotionEnvelope.Ease(t)),phase=layer*.8f;
            float lift=Mathf.Max(.08f,p.Lift),reach=p.Reach,offset=(layer-1)*.12f;
            float r=(.76f+layer*.105f)*spread;
            switch(p.Motif){
                case CinematicMotif.Fracture:{
                    float tooth=Mathf.Abs(Mathf.Sin(a*p.Lobes*.5f));float rr=r*(.65f+.35f*tooth);
                    return new Vector3(Mathf.Cos(a)*rr,.025f+lift*tooth*(1-t)*.7f,Mathf.Sin(a)*rr)*reach;
                }
                case CinematicMotif.Pillars:
                    return new Vector3((u*2-1)*spread, .08f+lift*(.6f+1.5f*Mathf.Abs(Mathf.Sin(a*p.Lobes*.5f)))*PremiumMotionEnvelope.Reveal(t),.18f+offset+.07f*Mathf.Sin(a))*reach;
                case CinematicMotif.Dome:
                    return new Vector3(Mathf.Cos(a)*r*Mathf.Cos(phase*.58f),.04f+lift*(layer+1)*spread,Mathf.Sin(a)*r*Mathf.Cos(phase*.58f))*reach;
                case CinematicMotif.Comet:case CinematicMotif.Corridor:
                    return new Vector3((layer-1)*.28f*spread+.12f*Mathf.Sin(a+phase)*spread,.1f+lift*Mathf.Sin(Mathf.PI*u),Mathf.Lerp(-.65f,1.1f,u)*spread)*reach;
                case CinematicMotif.Beacon:
                    return new Vector3(Mathf.Cos(a+phase+t*3)*r*.30f,.04f+u*lift*(1.5f+layer*.6f)*spread,Mathf.Sin(a+phase+t*3)*r*.30f)*reach;
                case CinematicMotif.Ribbon:
                    return new Vector3(.43f*Mathf.Sin(a+phase+t*2)*spread,.08f+lift*Mathf.Abs(Mathf.Sin(a*.5f+phase)),(u*2-1)*spread)*reach;
                case CinematicMotif.Harmonics:{
                    float rr=r*(.86f+.12f*Mathf.Sin(a*p.Lobes-t*5+phase));
                    return new Vector3(Mathf.Cos(a)*rr,.04f+lift*.65f*Mathf.Abs(Mathf.Sin(a*p.Lobes*.5f+phase)),Mathf.Sin(a)*rr)*reach;
                }
                case CinematicMotif.Spiral:
                    a=a*1.35f+t*4+phase;return new Vector3(Mathf.Cos(a)*r*(1-.45f*u),.04f+u*lift*1.8f,Mathf.Sin(a)*r*(1-.45f*u))*reach;
                case CinematicMotif.Bloom:case CinematicMotif.Vines:{
                    float petal=.60f+.35f*Mathf.Abs(Mathf.Cos(a*p.Lobes*.5f+phase));
                    return new Vector3(Mathf.Cos(a)*r*petal,.05f+lift*petal*(layer+1)*.55f,Mathf.Sin(a)*r*petal)*reach;
                }
                default:{
                    float star=r*(.62f+.32f*Mathf.Abs(Mathf.Cos(a*p.Lobes*.5f)));
                    return new Vector3(Mathf.Cos(a)*star,.06f+lift*layer*.4f,Mathf.Sin(a)*star)*reach;
                }
            }
        }
        internal static float Width(float u,float t,int layer)=>Mathf.Lerp(.055f,.105f,layer/2f)*(.35f+.65f*Mathf.Sin(Mathf.PI*u))*PremiumMotionEnvelope.Reveal(t);
        public void Tick(float now){
            if(!active)return;
            float t=(now-start)/Mathf.Max(.08f,cue.Duration);
            if(t>=1){Stop();return;}t=Mathf.Clamp01(t);
            float size=Mathf.Clamp(cue.Size,.05f,6f),fade=PremiumMotionEnvelope.Reveal(t);
            for(int l=0;l<Layers;l++)for(int i=0;i<=Segments;i++){
                float u=(float)i/Segments;int k=(l*(Segments+1)+i)*2;
                var p=Sample(profile,u,t,l)*size;
                var tangent=Sample(profile,Mathf.Min(1,u+.006f),t,l)-Sample(profile,Mathf.Max(0,u-.006f),t,l);
                var side=Vector3.Cross(Vector3.up,tangent);if(side.sqrMagnitude<.000001f)side=Vector3.right;else side.Normalize();
                var width=(side*.78f+Vector3.up*(l==1?.65f:.22f))*Width(u,t,l)*size;
                vertices[k]=p-width;vertices[k+1]=p+width;
                var c=Color.Lerp(tint,Color.white,l==1?.62f:.18f);c.a=fade*(l==1?.80f:.48f);colors[k]=colors[k+1]=c;
            }
            mesh.vertices=vertices;mesh.colors=colors;mesh.RecalculateBounds();renderer.enabled=true;
        }
        public void Stop(){active=false;if(renderer)renderer.enabled=false;}
        public void Dispose(){Stop();if(mesh)Object.Destroy(mesh);if(root)Object.Destroy(root);}
    }
}
