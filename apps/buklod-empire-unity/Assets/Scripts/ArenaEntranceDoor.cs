using UnityEngine;
namespace Buklod.Empire {
    // Decorative entrance only: never alters combat, navigation or victory.
    public sealed class ArenaEntranceDoor:MonoBehaviour {
        public Transform leaf;
        public AudioClip openSound;
        AudioSource sound;
        Quaternion closed;
        float elapsed;
        bool opening,focused=true,appPaused;
        public const float Duration=.8f;
        public bool IsOpening=>opening;
        void Awake(){if(leaf)closed=leaf.localRotation;sound=gameObject.AddComponent<AudioSource>();sound.playOnAwake=false;sound.spatialBlend=1;sound.minDistance=3;sound.maxDistance=24;sound.dopplerLevel=0;sound.rolloffMode=AudioRolloffMode.Linear;}
        public void Open(){if(!leaf)return;leaf.localRotation=closed;elapsed=0;opening=true;if(sound&&openSound&&Application.isFocused&&focused&&!appPaused){sound.Stop();sound.volume=ReviewAudioSettings.Get(ReviewAudioChannel.Effects);sound.PlayOneShot(openSound,.4f);}}
        void OnApplicationFocus(bool value){focused=value;if(!value&&sound)sound.Stop();}
        void OnApplicationPause(bool paused){appPaused=paused;if(paused&&sound)sound.Stop();}
        void Update(){
            if(!opening||!leaf||!focused||appPaused)return;
            elapsed+=Time.unscaledDeltaTime;
            float t=Mathf.SmoothStep(0,1,Mathf.Clamp01(elapsed/Duration));
            leaf.localRotation=closed*Quaternion.Euler(0,-95*t,0);
            if(t>=1)opening=false;
        }
    }
}
