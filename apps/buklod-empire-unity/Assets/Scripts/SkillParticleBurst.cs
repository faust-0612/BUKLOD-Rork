using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    // One reusable billboard mesh per existing pulse; no per-particle GameObjects.
    internal sealed class SkillParticleBurst {
        readonly GameObject root;readonly Mesh mesh;readonly MeshRenderer renderer;
        readonly Vector3[] vertices=new Vector3[SkillParticleMotion.Count*4];
        readonly Color[] colors=new Color[SkillParticleMotion.Count*4];
        readonly int count=SkillParticleMotion.Count;
        SkillCueShape shape;float radius;Color tint;Vector3 forward;
        CinematicSkillProfile cinematic;bool hasCinematic;
        public SkillParticleBurst(Transform parent,Material material){
            root=new GameObject("Pooled skill light particles");root.transform.SetParent(parent,false);
            mesh=new Mesh{name="Skill particle billboard mesh"};mesh.MarkDynamic();
            var uv=new Vector2[count*4];var indices=new int[count*6];
            for(int i=0;i<count;i++){
                int v=i*4,k=i*6;uv[v]=new Vector2(0,0);uv[v+1]=new Vector2(1,0);uv[v+2]=new Vector2(1,1);uv[v+3]=new Vector2(0,1);
                indices[k]=v;indices[k+1]=v+1;indices[k+2]=v+2;indices[k+3]=v;indices[k+4]=v+2;indices[k+5]=v+3;
            }
            mesh.vertices=vertices;mesh.uv=uv;mesh.triangles=indices;mesh.colors=colors;
            root.AddComponent<MeshFilter>().sharedMesh=mesh;
            renderer=root.AddComponent<MeshRenderer>();renderer.sharedMaterial=material;renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;renderer.enabled=false;
        }
        public void Begin(Vector3 at,Color color,SkillCue cue,Vector3 direction){
            root.transform.position=at;shape=cue.Shape;radius=cue.Size;tint=color;
            hasCinematic=CinematicSkillCatalog.TryGet(cue.Id,out cinematic);
            direction.y=0;forward=direction.sqrMagnitude>.001f?direction.normalized:Vector3.forward;
            renderer.enabled=true;
        }
        public void Draw(float t,Camera camera){
            if(!camera){Stop();return;}
            Vector3 side=Vector3.Cross(Vector3.up,forward);
            var right=root.transform.InverseTransformVector(camera.transform.right);
            var up=root.transform.InverseTransformVector(camera.transform.up);
            for(int i=0;i<count;i++){
                int primaryCount=hasCinematic?count-CinematicSkillCatalog.AccentCount:count;
                bool accent=i>=primaryCount;
                int primaryIndex=hasCinematic?Mathf.RoundToInt(i*(count-1f)/(primaryCount-1)):i;
                var s=accent?CinematicSkillCatalog.Evaluate(cinematic,i-primaryCount,t,radius):SkillParticleMotion.Evaluate(shape,primaryIndex,t,radius);
                Vector3 position=root.transform.InverseTransformVector(side*s.Position.x+Vector3.up*s.Position.y+forward*s.Position.z);
                Vector3 a=right*s.Size,b=up*s.Size*s.Stretch;
                if(!accent&&(shape==SkillCueShape.Dash||shape==SkillCueShape.Bolt||shape==SkillCueShape.Surge)){
                    // Align elongated particles to the screen-space projected cast direction.
                    var dir=forward-camera.transform.forward*Vector3.Dot(forward,camera.transform.forward);
                    if(dir.sqrMagnitude>.001f){dir.Normalize();b=root.transform.InverseTransformVector(dir)*s.Size*s.Stretch;a=root.transform.InverseTransformVector(Vector3.Cross(camera.transform.forward,dir).normalized)*s.Size;}
                }
                int k=i*4;vertices[k]=position-a-b;vertices[k+1]=position+a-b;vertices[k+2]=position+a+b;vertices[k+3]=position-a+b;
                var c=Color.Lerp(tint,Color.white,accent?.42f:i%4==0?.52f:.12f);c.a=Mathf.Clamp01(s.Opacity);
                colors[k]=colors[k+1]=colors[k+2]=colors[k+3]=c;
            }
            mesh.vertices=vertices;mesh.colors=colors;mesh.RecalculateBounds();renderer.enabled=true;
        }
        public void Stop(){renderer.enabled=false;}
        public void Dispose(){if(mesh)Object.Destroy(mesh);}
    }
}
