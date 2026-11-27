using System;
using UnityEngine;
namespace Buklod.Empire {
    // Authored from the actual imported static mesh. No physics or extra hitboxes.
    public sealed class ReviewStructureFragments:MonoBehaviour {
        [Serializable] public sealed class Piece {public Transform root;public Vector3 origin;public Vector3 direction;public int tier;}
        public Renderer[] originals;
        public Piece[] pieces;
        bool playing;
        public bool Ready=>originals!=null&&originals.Length>0&&pieces!=null&&pieces.Length>=2;
        public bool Begin(){if(!Ready)return false;ResetVisual();playing=true;foreach(var r in originals)if(r)r.enabled=false;foreach(var p in pieces)if(p!=null&&p.root)p.root.gameObject.SetActive(true);return true;}
        public static Vector3 Offset(Vector3 direction,int tier,float time,float height){
            float t=Mathf.Clamp01(time),delay=Mathf.Clamp(tier*.055f,0,.25f);
            float p=Mathf.Clamp01((t-delay)/(1-delay));
            return direction*(height*.13f*p)+Vector3.up*(height*(.12f*4*p*(1-p)-.38f*p*p));
        }
        public void Apply(float time,float height,int id){
            if(!playing)return;float t=Mathf.Clamp01(time);
            for(int i=0;i<pieces.Length;i++){var p=pieces[i];if(p==null||!p.root)continue;
                p.root.localPosition=p.origin+Offset(p.direction,p.tier,t,height);
                float sign=((i+id)&1)==0?1:-1;float q=Mathf.SmoothStep(0,1,t);
                p.root.localRotation=Quaternion.Euler(sign*32*q,sign*17*q,sign*24*q);
                p.root.localScale=Vector3.one*Mathf.Lerp(1,.24f,Mathf.SmoothStep(0,1,Mathf.InverseLerp(.6f,1,t)));
            }
        }
        public void ResetVisual(){if(!Ready)return;playing=false;foreach(var r in originals)if(r)r.enabled=true;
            foreach(var p in pieces)if(p!=null&&p.root){p.root.localPosition=p.origin;p.root.localRotation=Quaternion.identity;p.root.localScale=Vector3.one;p.root.gameObject.SetActive(false);}
        }
        void OnDisable(){if(playing)ResetVisual();}
    }
}
