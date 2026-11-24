using UnityEngine;
namespace Buklod.Empire {
    // Review-only music, ambience, result and spatial creature cues.
    public sealed class ReviewPresentationAudio:MonoBehaviour {
        public AudioClip menu,battle,ambience,victory,defeat,draw,entrance;
        public AudioClip[] attacks,defeats;
        const int VoiceLimit=4;
        BattleView view;OfflineBattle match;AudioSource music,ambient,stinger;
        AudioSource[] voices;int next;
        bool entered,result;
        AudioSource Voice(string name,bool spatial){
            var go=new GameObject(name);go.transform.SetParent(transform,false);
            var source=go.AddComponent<AudioSource>();source.playOnAwake=false;source.spatialBlend=spatial?1:0;
            source.dopplerLevel=0;source.rolloffMode=AudioRolloffMode.Linear;source.minDistance=4;source.maxDistance=48;
            return source;
        }
        void Awake(){
            view=GetComponent<BattleView>();if(!view||!view.IsEditorReview){enabled=false;return;}
            music=Voice("Review score",false);ambient=Voice("Review ambience",false);stinger=Voice("Review result",false);
            voices=new AudioSource[VoiceLimit];for(int i=0;i<voices.Length;i++)voices[i]=Voice("Creature voice "+i,true);
        }
        static void Loop(AudioSource source,AudioClip clip,float volume){
            if(source.clip==clip&&source.isPlaying)return;
            source.Stop();source.clip=clip;source.loop=true;source.volume=volume;if(clip)source.Play();
        }
        void StopSpatial(){if(voices!=null)foreach(var s in voices)s.Stop();}
        void Update(){
            if(!view||view.Battle==null||!music)return;
            var b=view.Battle;
            if(match!=b){match=b;entered=false;result=false;stinger.Stop();StopSpatial();}
            if(b.Finished){
                music.Stop();ambient.Stop();StopSpatial();
                if(!result){result=true;var cue=!b.Winner.HasValue?draw:b.Winner.Value==b.Player.Team?victory:defeat;stinger.Stop();if(cue)stinger.PlayOneShot(cue,.35f);}
                return;
            }
            if(view.Paused){
                Loop(music,menu,.27f);ambient.Stop();StopSpatial();stinger.Stop();return;
            }
            Loop(music,battle,.24f);Loop(ambient,ambience,.20f);
            if(!entered){entered=true;if(entrance)stinger.PlayOneShot(entrance,.36f);}
        }
        public void Creature(WildernessKind kind,bool defeated,Vector3 position){
            if(!isActiveAndEnabled||!view||!view.IsEditorReview||view.Paused||view.Battle==null||view.Battle.Finished||voices==null)return;
            var clips=defeated?defeats:attacks;int i=(int)kind;
            if(clips==null||i<0||i>=clips.Length||!clips[i])return;
            if(Vector3.Distance(view.FieldPosition(view.Battle.Player.Position),position)>38)return;
            var s=voices[next];next=(next+1)%voices.Length;s.Stop();s.transform.position=position;
            s.clip=clips[i];s.volume=defeated?.43f:.30f;s.Play();
        }
        void OnDisable(){if(music)music.Stop();if(ambient)ambient.Stop();if(stinger)stinger.Stop();StopSpatial();}
    }
}
