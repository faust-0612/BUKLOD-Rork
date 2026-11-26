using UnityEngine;
namespace Buklod.Empire {
    public sealed class ArenaAuthoredUi:MonoBehaviour {
        public Sprite action,stickPad,stickNub,menuButton,menuPanel;
        public AudioClip click;
        public ArenaEntranceDoor entrance;
        AudioSource source;
        public void Click(){
            if(!click)return;
            if(!source){source=gameObject.AddComponent<AudioSource>();source.playOnAwake=false;source.spatialBlend=0;source.volume=.35f;}
            source.PlayOneShot(click);
        }
    }
}
