using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    // Bounded reusable debris meshes. Never creates a physics object.
    public sealed class WorldInteractionEffects:MonoBehaviour {
        public const int Capacity=12;
        public Material debrisMaterial;
        static readonly Vector3[] Corners={new Vector3(0,1,0),new Vector3(-1,-.55f,-.7f),new Vector3(1,-.55f,-.7f),new Vector3(0,-.55f,1)};
        static readonly int[] Faces={0,2,1,0,3,2,0,1,3,1,2,3};
        sealed class Burst {
            public GameObject Root;public Mesh Mesh;public MeshRenderer Renderer;
            public Vector3[] Positions=new Vector3[WorldImpactMotion.Fragments*12];
            public Vector3[] Normals=new Vector3[WorldImpactMotion.Fragments*12];
            public Color[] Colors=new Color[WorldImpactMotion.Fragments*12];
            public WorldImpactKind Kind;public int Seed;public float Elapsed;public Color Tint;
        }
        Burst[] pool;int next;BattleView view;
        void Initialize(){
            if(pool!=null||!debrisMaterial)return;
            view=GetComponent<BattleView>();pool=new Burst[Capacity];
            for(int i=0;i<Capacity;i++){
                var b=new Burst();b.Root=new GameObject("Pooled world fragments");b.Root.transform.SetParent(transform,false);
                b.Mesh=new Mesh{name="World interaction fragments"};b.Mesh.MarkDynamic();
                var indices=new int[b.Positions.Length];for(int j=0;j<indices.Length;j++)indices[j]=j;
                b.Mesh.vertices=b.Positions;b.Mesh.normals=b.Normals;b.Mesh.colors=b.Colors;b.Mesh.triangles=indices;
                b.Root.AddComponent<MeshFilter>().sharedMesh=b.Mesh;
                b.Renderer=b.Root.AddComponent<MeshRenderer>();b.Renderer.sharedMaterial=debrisMaterial;
                b.Renderer.shadowCastingMode=ShadowCastingMode.Off;b.Renderer.receiveShadows=false;b.Renderer.enabled=false;pool[i]=b;
            }
        }
        public void Emit(Vector3 at,WorldImpactKind kind,int seed,Color tint){
            Initialize();if(pool==null)return;
            var b=pool[next];next=(next+1)%Capacity;b.Root.transform.position=at;
            b.Kind=kind;b.Seed=seed;b.Elapsed=0;b.Tint=tint;
            Draw(b,0);b.Renderer.enabled=true;
        }
        static void Draw(Burst b,float t){
            for(int i=0;i<WorldImpactMotion.Fragments;i++){
                var s=WorldImpactMotion.Evaluate(b.Kind,b.Seed,i,t);var rotation=Quaternion.Euler(s.Rotation);
                Color c=Color.Lerp(b.Tint,Color.white,(i%4)*.12f);
                for(int j=0;j<12;j+=3){
                    Vector3 a=rotation*Corners[Faces[j]],d=rotation*Corners[Faces[j+1]],e=rotation*Corners[Faces[j+2]];
                    var n=Vector3.Cross(d-a,e-a).normalized;int k=i*12+j;
                    b.Positions[k]=s.Position+a*s.Size;b.Positions[k+1]=s.Position+d*s.Size;b.Positions[k+2]=s.Position+e*s.Size;
                    b.Normals[k]=b.Normals[k+1]=b.Normals[k+2]=n;b.Colors[k]=b.Colors[k+1]=b.Colors[k+2]=c;
                }
            }
            b.Mesh.vertices=b.Positions;b.Mesh.normals=b.Normals;b.Mesh.colors=b.Colors;b.Mesh.RecalculateBounds();
        }
        void Update(){
            if(pool==null||(view&&view.Paused))return;
            foreach(var b in pool)if(b.Renderer.enabled){
                b.Elapsed+=Time.deltaTime;float t=b.Elapsed/WorldImpactMotion.Duration(b.Kind);
                if(t>=1)b.Renderer.enabled=false;else Draw(b,t);
            }
        }
        public void Clear(){if(pool!=null)foreach(var b in pool)b.Renderer.enabled=false;next=0;}
        void OnDisable(){Clear();}
        void OnDestroy(){if(pool!=null)foreach(var b in pool){if(b.Mesh)Destroy(b.Mesh);if(b.Root)Destroy(b.Root);}}
    }
}
