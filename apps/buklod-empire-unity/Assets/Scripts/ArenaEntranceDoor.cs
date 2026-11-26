using UnityEngine;
namespace Buklod.Empire {
    // Decorative entrance only: never alters combat, navigation or victory.
    public sealed class ArenaEntranceDoor:MonoBehaviour {
        public Transform leaf;
        Quaternion closed;
        float elapsed;
        bool opening;
        void Awake(){if(leaf)closed=leaf.localRotation;}
        public void Open(){if(!leaf)return;leaf.localRotation=closed;elapsed=0;opening=true;}
        void Update(){
            if(!opening||!leaf)return;
            elapsed+=Time.unscaledDeltaTime;
            float t=Mathf.SmoothStep(0,1,Mathf.Clamp01(elapsed/.8f));
            leaf.localRotation=closed*Quaternion.Euler(0,-95*t,0);
            if(t>=1)opening=false;
        }
    }
}
