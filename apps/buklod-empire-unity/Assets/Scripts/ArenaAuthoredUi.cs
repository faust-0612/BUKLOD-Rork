using UnityEngine;
namespace Buklod.Empire {
    public sealed class ArenaAuthoredUi:MonoBehaviour {
        public Sprite action,stickPad,stickNub,menuButton,menuPanel;
        public AudioClip click,purchase,pickup,relic;
        public ArenaEntranceDoor entrance;
        AudioSource source,feedback;
        float nextFeedback;
        public void AcceptedAction(string action,string pickupEffect=null){
            AudioClip cue=action=="Purchased"?purchase:action=="Picked up"?ArenaReviewFoley.PickupClip(pickupEffect,pickup):action=="Relic acquired"?relic:null;
            if(!cue||Time.unscaledTime<nextFeedback)return;
            if(!feedback){feedback=gameObject.AddComponent<AudioSource>();feedback.playOnAwake=false;feedback.spatialBlend=0;}
            feedback.Stop();feedback.volume=.32f*ReviewAudioSettings.Get(ReviewAudioChannel.Effects);
            feedback.PlayOneShot(EmpireContentUpdater.Resolve(cue));nextFeedback=Time.unscaledTime+.15f;
        }
        void OnDisable(){if(source)source.Stop();if(feedback)feedback.Stop();}
        void OnApplicationPause(bool paused){if(paused){if(source)source.Stop();if(feedback)feedback.Stop();}}
        public void Click(){
            if(!click)return;
            if(!source){source=gameObject.AddComponent<AudioSource>();source.playOnAwake=false;source.spatialBlend=0;source.volume=.35f;}
            source.volume=.35f*ReviewAudioSettings.Get(ReviewAudioChannel.Effects);
            source.PlayOneShot(click);
        }
    }
}
