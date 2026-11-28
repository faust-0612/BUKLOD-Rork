using UnityEngine;
using UnityEngine.Rendering;
namespace Buklod.Empire {
    // Review-only visual trace. Samples a point rigidly attached to the actual
    // imported Hand_R skeleton AFTER Animator evaluation. No combat authority.
    // The composer derives the anchor from weighted weapon/hand geometry where readable.
    [DisallowMultipleComponent]
    public sealed class ReviewWeaponTrail:MonoBehaviour {
        public const int Samples=16;
        [SerializeField] Transform hand;
        [SerializeField] Vector3 anchor;
        [SerializeField] bool geometryDerived;
        public Transform Hand=>hand;
        public Vector3 Anchor=>anchor;
        public bool GeometryDerived=>geometryDerived;
        Animator animator;Mesh mesh;MeshRenderer ribbon;Color tint;
        readonly Vector3[] tips=new Vector3[Samples],bases=new Vector3[Samples];
        readonly Vector3[] vertices=new Vector3[Samples*2];
        readonly Vector2[] uv=new Vector2[Samples*2];
        readonly Color[] colors=new Color[Samples*2];
        readonly int[] indices=new int[(Samples-1)*6];
        int count;float remaining,wait;bool visible,armed,started;string action="Attack";
        internal static bool IsRightHand(string name)=>name=="Hand_R"||name=="mixamorig:RightHand"||name=="mixamorig_RightHand"||name=="RightHand";
        internal static float Fade(float age)=>Mathf.Clamp01(age)*Mathf.Clamp01(age);
        public static bool Finite(Vector3 p)=>!float.IsNaN(p.x)&&!float.IsInfinity(p.x)&&!float.IsNaN(p.y)&&!float.IsInfinity(p.y)&&!float.IsNaN(p.z)&&!float.IsInfinity(p.z);
        public void Configure(Transform bone,Vector3 localAnchor,bool derived){
            if(!bone||!IsRightHand(bone.name)||!bone.IsChildOf(transform)||!Finite(localAnchor)||localAnchor.sqrMagnitude<.0025f)throw new System.ArgumentException("Invalid weapon trail binding");
            hand=bone;anchor=localAnchor;geometryDerived=derived;
        }
        // These offsets follow the original equipment dimensions, only for an unreadable imported mesh.
        public static Vector3 FallbackAnchor(string hero){
            switch(ReviewWeaponProfiles.Get(hero).Equipment){
                case "mallet":return new Vector3(0,.42f,.05f);
                case "compass":return new Vector3(0,.15f,.05f);
                case "shield":return new Vector3(0,-.22f,.11f);
                case "banner":return new Vector3(0,.67f,.05f);
                case "tambourine":return new Vector3(0,.18f,.05f);
                case "cuff":return new Vector3(0,0,.22f);
                case "crook":return new Vector3(0,.63f,.05f);
                case "radio":return new Vector3(0,.23f,.05f);
                case "caddy":return new Vector3(0,.20f,.05f);
                case "loudhailer":return new Vector3(0,.22f,.12f);
                case "ledger":return new Vector3(0,.15f,.10f);
                case "trowel":return new Vector3(0,.43f,.05f);
                case "puppet":return new Vector3(0,.32f,.05f);
                default:throw new System.ArgumentException("Unknown equipment");
            }
        }
        internal void Bind(Animator rig,Material material,Color color){
            Cancel();animator=rig;tint=color;visible=false;
            if(!hand||!animator||!material)return;
            if(!ribbon){
                var go=new GameObject("Rig-sampled swept weapon surface");go.transform.SetParent(transform,false);go.layer=gameObject.layer;
                mesh=new Mesh{name="Swept actual hand ribbon"};mesh.MarkDynamic();
                for(int i=0;i<Samples-1;i++){int k=i*2,j=i*6;indices[j]=k;indices[j+1]=k+1;indices[j+2]=k+2;indices[j+3]=k+1;indices[j+4]=k+3;indices[j+5]=k+2;}
                mesh.vertices=vertices;mesh.uv=uv;mesh.colors=colors;mesh.triangles=indices;
                go.AddComponent<MeshFilter>().sharedMesh=mesh;
                ribbon=go.AddComponent<MeshRenderer>();ribbon.shadowCastingMode=ShadowCastingMode.Off;ribbon.receiveShadows=false;
            }
            ribbon.sharedMaterial=material;ribbon.enabled=false;
        }
        internal void SetVisible(bool value){visible=value;if(!visible)Cancel();}
        internal void Begin(string state="Attack",float length=.38f){
            Cancel();if(!visible||!hand||!ribbon||!animator||string.IsNullOrEmpty(state))return;
            action=state;armed=true;wait=.25f;remaining=Mathf.Clamp(length,.14f,.7f);
        }
        internal void Cancel(){armed=started=false;count=0;if(ribbon)ribbon.enabled=false;}
        bool Matches(AnimatorStateInfo state)=>state.IsName(action)||state.IsName("Base Layer."+action);
        void LateUpdate(){
            if(!armed)return;
            if(!visible||!hand||!ribbon||!animator||!Application.isFocused){Cancel();return;}
            float dt=Mathf.Clamp(Time.deltaTime,0,.1f);
            bool playing=Matches(animator.GetCurrentAnimatorStateInfo(0));
            if(animator.IsInTransition(0))playing|=Matches(animator.GetNextAnimatorStateInfo(0));
            if(!started&&!playing){wait-=dt;if(wait<=0)Cancel();return;}
            if(!playing||remaining<=0){Cancel();return;}
            started=true;remaining-=dt;
            Vector3 tip=hand.TransformPoint(anchor),basis=hand.TransformPoint(anchor*.28f);
            if(!Finite(tip)||!Finite(basis)){Cancel();return;}
            if(count>0){float dist=(tips[count-1]-tip).sqrMagnitude;if(dist>4){Cancel();return;}if(dist<.000025f)return;}
            if(count==Samples){for(int i=1;i<Samples;i++){tips[i-1]=tips[i];bases[i-1]=bases[i];}count--;}
            tips[count]=tip;bases[count]=basis;count++;
            if(count<2)return;
            // A swept surface between two points on the real hand/bound geometry,
            // not a billboard or a separate fake slash floating above the character.
            for(int i=0;i<Samples;i++){
                int j=Mathf.Min(i,count-1);float u=j/(float)(count-1);int k=i*2;
                var edge=Vector3.Lerp(tips[j],bases[j],Mathf.Lerp(.75f,0,u));
                vertices[k]=ribbon.transform.InverseTransformPoint(edge);
                vertices[k+1]=ribbon.transform.InverseTransformPoint(bases[j]);
                uv[k]=new Vector2(u,0);uv[k+1]=new Vector2(u,1);
                var c=Color.Lerp(tint,Color.white,.52f);c.a=.82f*Fade(u);colors[k]=colors[k+1]=c;
            }
            mesh.vertices=vertices;mesh.uv=uv;mesh.colors=colors;mesh.RecalculateBounds();ribbon.enabled=true;
        }
        void OnDestroy(){if(mesh)Destroy(mesh);}
        void OnDisable(){visible=false;Cancel();}
        void OnApplicationFocus(bool value){if(!value)Cancel();}
        void OnApplicationPause(bool value){if(value)Cancel();}
    }
}
