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
        Animator animator;LineRenderer line;Color tint;
        readonly Vector3[] points=new Vector3[Samples];
        int count;float remaining,wait;bool visible,armed,started;
        public static bool Finite(Vector3 p)=>!float.IsNaN(p.x)&&!float.IsInfinity(p.x)&&!float.IsNaN(p.y)&&!float.IsInfinity(p.y)&&!float.IsNaN(p.z)&&!float.IsInfinity(p.z);
        public void Configure(Transform bone,Vector3 localAnchor,bool derived){
            if(!bone||bone.name!="Hand_R"||!bone.IsChildOf(transform)||!Finite(localAnchor)||localAnchor.sqrMagnitude<.0025f)throw new System.ArgumentException("Invalid weapon trail binding");
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
            if(!line){
                var go=new GameObject("Rig-sampled weapon trace");go.transform.SetParent(transform,false);go.layer=gameObject.layer;
                line=go.AddComponent<LineRenderer>();line.useWorldSpace=true;line.sharedMaterial=material;line.shadowCastingMode=ShadowCastingMode.Off;line.receiveShadows=false;
                line.numCapVertices=2;line.numCornerVertices=2;line.widthCurve=new AnimationCurve(new Keyframe(0,0),new Keyframe(.65f,.65f),new Keyframe(1,1));line.widthMultiplier=.075f;
                line.positionCount=0;line.enabled=false;
            }
            var fade=tint;fade.a=0;var hot=Color.Lerp(tint,Color.white,.42f);hot.a=.72f;line.startColor=fade;line.endColor=hot;
        }
        internal void SetVisible(bool value){visible=value;if(!visible)Cancel();}
        internal void Begin(){Cancel();if(!visible||!hand||!line||!animator)return;armed=true;wait=.22f;remaining=.38f;}
        internal void Cancel(){armed=started=false;count=0;if(line){line.enabled=false;line.positionCount=0;}}
        void LateUpdate(){
            if(!armed)return;
            if(!visible||!hand||!line||!animator||!Application.isFocused){Cancel();return;}
            float dt=Mathf.Clamp(Time.deltaTime,0,.1f);
            var state=animator.GetCurrentAnimatorStateInfo(0);bool attack=state.IsName("Attack")||state.IsName("Base Layer.Attack");
            if(animator.IsInTransition(0)){var next=animator.GetNextAnimatorStateInfo(0);attack|=next.IsName("Attack")||next.IsName("Base Layer.Attack");}
            if(!started&&!attack){wait-=dt;if(wait<=0)Cancel();return;}
            if(!attack||remaining<=0){Cancel();return;}
            started=true;remaining-=dt;Vector3 point=hand.TransformPoint(anchor);
            if(!Finite(point)){Cancel();return;}
            if(count>0){float dist=(points[count-1]-point).sqrMagnitude;if(dist>4){Cancel();return;}if(dist<.000025f)return;}
            if(count==Samples){for(int i=1;i<Samples;i++)points[i-1]=points[i];count--;}
            points[count++]=point;line.positionCount=count;for(int i=0;i<count;i++)line.SetPosition(i,points[i]);line.enabled=count>1;
        }
        void OnDisable(){visible=false;Cancel();}
        void OnApplicationFocus(bool value){if(!value)Cancel();}
        void OnApplicationPause(bool value){if(value)Cancel();}
    }
}
