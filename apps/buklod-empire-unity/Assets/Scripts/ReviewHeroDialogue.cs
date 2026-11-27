using System;
using UnityEngine;
namespace Buklod.Empire {
    // Local fictional lines and optional synthetic preview, never network speech.
    public sealed class ReviewHeroDialogue:MonoBehaviour {
        [Serializable] public sealed class Entry {public string id,selection,ultimate;public AudioClip selectionClip,ultimateClip;}
        public Entry[] entries;public string battleStart;public AudioClip battleStartClip;
        BattleView view;AudioSource voice;float nextVoice,captionUntil;string caption="";
        bool focused=true,appPaused;
        void Awake(){
            view=GetComponent<BattleView>();if(!view||!view.IsEditorReview){enabled=false;return;}
            voice=gameObject.AddComponent<AudioSource>();voice.playOnAwake=false;voice.spatialBlend=0;voice.loop=false;
        }
        AudioClip currentClip;
        Entry Find(string id){if(entries!=null)foreach(var row in entries)if(row!=null&&row.id==id)return row;return null;}
        void Speak(AudioClip clip){
            if(!isActiveAndEnabled||!focused||appPaused||!voice)return;
            if(!clip){voice.Stop();currentClip=null;return;}
            if(currentClip==clip&&Time.unscaledTime<nextVoice)return;
            nextVoice=Time.unscaledTime+.5f;voice.Stop();currentClip=clip;voice.volume=.65f*ReviewAudioSettings.Get(ReviewAudioChannel.Voice);voice.PlayOneShot(clip);
        }
        public string Select(string id){var row=Find(id);if(row==null)return "";Speak(row.selectionClip);return row.selection;}
        public string PreviewUltimate(string id){if(!view||!view.IsEditorReview||!view.Paused)return "";var row=Find(id);if(row==null)return "";Speak(row.ultimateClip);return row.ultimate;}
        public void AnnounceBattleStart(){
            if(!isActiveAndEnabled||!view||view.Paused||!focused||appPaused||string.IsNullOrEmpty(battleStart))return;
            caption=battleStart;captionUntil=Time.unscaledTime+Mathf.Clamp(battleStartClip?battleStartClip.length:3,2,6);Speak(battleStartClip);
        }
        public void Ultimate(string id){
            if(!isActiveAndEnabled||!view||view.Paused||!focused||appPaused)return;
            var row=Find(id);if(row==null)return;
            caption=HeroKitCatalog.Get(id).Name+": "+row.ultimate;captionUntil=Time.unscaledTime+Mathf.Clamp(row.ultimateClip?row.ultimateClip.length:3,2,6);
            Speak(row.ultimateClip);
        }
        public string Caption=>!view||view.Paused||view.Battle==null||view.Battle.Finished||Time.unscaledTime>=captionUntil?"":caption;
        public void Stop(){if(voice)voice.Stop();currentClip=null;caption="";captionUntil=0;nextVoice=0;}
        void Update(){if(voice)voice.volume=.65f*ReviewAudioSettings.Get(ReviewAudioChannel.Voice);}
        void OnApplicationFocus(bool value){focused=value;if(!value)Stop();}
        void OnApplicationPause(bool value){appPaused=value;if(value)Stop();}
        void OnDisable(){Stop();}
    }
}
