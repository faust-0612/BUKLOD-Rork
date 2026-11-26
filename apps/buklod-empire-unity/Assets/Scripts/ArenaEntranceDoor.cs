using UnityEngine;
namespace Buklod.Empire {
    // Decorative entrance only: never alters combat, navigation or victory.
    public sealed class ArenaEntranceDoor:MonoBehaviour {
        public Transform leaf;
        public AudioClip openSound;
        AudioSource sound;
        Quaternion closed;
        float elapsed;
        bool opening;
        void Awake(){if(leaf)closed=leaf.localRotation;sound=gameObject.AddComponent<AudioSource>();sound.playOnAwake=false;sound.spatialBlend=1;sound.minDistance=3;sound.maxDistance=24;sound.dopplerLevel=0;sound.rolloffMode=AudioRolloffMode.Linear;}
        public void Open(){if(!leaf)return;leaf.localRotation=closed;elapsed=0;opening=true;if(sound&&openSound&&Application.isFocused){sound.Stop();sound.PlayOneShot(openSound,.4f);}}
        void OnApplicationFocus(bool focused){if(!focused&&sound)sound.Stop();}
        void OnApplicationPause(bool paused){if(paused&&sound)sound.Stop();}
        void Update(){
            if(!opening||!leaf)return;
            elapsed+=Time.unscaledDeltaTime;
            float t=Mathf.SmoothStep(0,1,Mathf.Clamp01(elapsed/.8f));
            leaf.localRotation=closed*Quaternion.Euler(0,-95*t,0);
            if(t>=1)opening=false;
        }
    }
}
