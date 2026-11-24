using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    // Supplemental visual contact shadow, not a physics surface or visibility source.
    // One mesh, fixed budget, no per-unit objects; populated only after BattleView visibility checks.
    public sealed class ReviewContactShadows:MonoBehaviour {
        public const int Capacity=160;
        public Material material;
        readonly Vector3[] vertices=new Vector3[Capacity*4];
        readonly Vector2[] uv=new Vector2[Capacity*4];
        readonly Color32[] colors=new Color32[Capacity*4];
        readonly int[] indices=new int[Capacity*6];
        Mesh mesh;MeshRenderer output;GameObject root;int count;
        public static float Radius(BattleTargetKind kind,bool core)=>kind==BattleTargetKind.Structure?(core?2.7f:1.65f):kind==BattleTargetKind.Hero?.90f:kind==BattleTargetKind.Villager?.60f:.55f;
        void Ensure(){
            if(mesh||!material)return;
            root=new GameObject("Review contact ground mesh");root.transform.SetParent(transform,false);
            mesh=new Mesh{name="Bounded contact shadow quads"};mesh.MarkDynamic();
            for(int i=0;i<Capacity;i++){
                int k=i*4,j=i*6;
                uv[k]=Vector2.zero;uv[k+1]=Vector2.right;uv[k+2]=Vector2.one;uv[k+3]=Vector2.up;
                indices[j]=k;indices[j+1]=k+2;indices[j+2]=k+1;indices[j+3]=k;indices[j+4]=k+3;indices[j+5]=k+2;
            }
            mesh.vertices=vertices;mesh.uv=uv;mesh.colors32=colors;mesh.triangles=indices;
            root.AddComponent<MeshFilter>().sharedMesh=mesh;output=root.AddComponent<MeshRenderer>();
            output.sharedMaterial=material;output.shadowCastingMode=ShadowCastingMode.Off;output.receiveShadows=false;output.enabled=false;
        }
        public void Begin(){count=0;Ensure();}
        public void Add(Vector3 world,BattleTargetKind kind,bool core,float worldScale){
            if(!mesh||count>=Capacity||worldScale<=0)return;
            float radius=Radius(kind,core)*worldScale;
            var p=root.transform.InverseTransformPoint(world+Vector3.up*.045f*worldScale);
            var x=root.transform.InverseTransformVector(Vector3.right*radius);
            var z=root.transform.InverseTransformVector(Vector3.forward*radius*.78f);
            int k=count++*4;vertices[k]=p-x-z;vertices[k+1]=p+x-z;vertices[k+2]=p+x+z;vertices[k+3]=p-x+z;
            var c=new Color32(255,255,255,(byte)(kind==BattleTargetKind.Structure?80:110));
            colors[k]=colors[k+1]=colors[k+2]=colors[k+3]=c;
        }
        public void End(){
            if(!mesh)return;
            if(count==0){output.enabled=false;return;}
            mesh.vertices=vertices;mesh.colors32=colors;
            // Only submitted indices participate; old frame vertices cannot render.
            mesh.SetIndices(indices,0,count*6,MeshTopology.Triangles,0,false);
            var bounds=new Bounds(vertices[0],Vector3.zero);
            for(int i=1;i<count*4;i++)bounds.Encapsulate(vertices[i]);
            mesh.bounds=bounds;output.enabled=true;
        }
        public void Clear(){count=0;if(output)output.enabled=false;}
        void OnDisable(){Clear();}
        void OnDestroy(){if(mesh)Destroy(mesh);if(root)Destroy(root);}
    }
}
