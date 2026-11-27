using UnityEngine;
namespace Buklod.Empire {
    // Review-only music, ambience, result and spatial creature cues.
    public sealed class ReviewPresentationAudio:MonoBehaviour {
        public AudioClip menu,battle,ambience,victory,defeat,draw,entrance;
        public AudioClip[] attacks,defeats;
        const int VoiceLimit=4;
        BattleView view;OfflineBattle match;AudioSource music,combatScore,ambient,stinger;
        float combatMix,nextAssessment,lastDamage,combatUntil;
        AudioSource[] voices;int next;
        bool entered,result,focused=true,appPaused;
        AudioSource Voice(string name,bool spatial){
            var go=new GameObject(name);go.transform.SetParent(transform,false);
            var source=go.AddComponent<AudioSource>();source.playOnAwake=false;source.spatialBlend=spatial?1:0;
            source.dopplerLevel=0;source.rolloffMode=AudioRolloffMode.Linear;source.minDistance=4;source.maxDistance=48;
            return source;
        }
        void Awake(){
            view=GetComponent<BattleView>();if(!view||!view.IsEditorReview){enabled=false;return;}
            music=Voice("Review calm score",false);combatScore=Voice("Review combat score",false);ambient=Voice("Review ambience",false);stinger=Voice("Review result",false);
            voices=new AudioSource[VoiceLimit];for(int i=0;i<voices.Length;i++)voices[i]=Voice("Creature voice "+i,true);
        }
        static void Loop(AudioSource source,AudioClip clip,float volume){
            source.volume=volume;
            if(source.clip==clip&&source.isPlaying)return;
            source.Stop();source.clip=clip;source.loop=true;source.volume=volume;if(clip)source.Play();
        }
        // Smooth complementary gains keep both scores phase-continuous across UI and combat.
        public static float ApproachMix(float current,float target,float seconds){
            return Mathf.MoveTowards(Mathf.Clamp01(current),Mathf.Clamp01(target),Mathf.Max(0,seconds)*.8f);
        }
        void Score(float target,float gain){
            combatMix=ApproachMix(combatMix,target,Time.unscaledDeltaTime);
            Loop(music,menu,.27f*gain*(1-combatMix));
            Loop(combatScore,battle,.24f*gain*combatMix);
        }
        void StopSpatial(){if(voices!=null)foreach(var s in voices)s.Stop();}
        void Update(){
            if(!view||!music||!focused||appPaused)return;
            var b=view.Battle;
            float musicGain=ReviewAudioSettings.Get(ReviewAudioChannel.Music),effectsGain=ReviewAudioSettings.Get(ReviewAudioChannel.Effects);
            stinger.volume=effectsGain;foreach(var voice in voices)voice.volume=effectsGain;
            if(b==null){Score(0,musicGain);ambient.Stop();StopSpatial();return;}
            if(match!=b){match=b;entered=false;result=false;combatMix=0;nextAssessment=0;combatUntil=0;lastDamage=b.Player.DamageTaken;stinger.Stop();StopSpatial();}
            if(b.Finished){
                music.Stop();combatScore.Stop();ambient.Stop();StopSpatial();
                if(!result){result=true;var cue=!b.Winner.HasValue?draw:b.Winner.Value==b.Player.Team?victory:defeat;stinger.Stop();if(cue)stinger.PlayOneShot(cue,.35f);}
                return;
            }
            if(view.Paused){
                Score(0,musicGain);ambient.Stop();StopSpatial();stinger.Stop();return;
            }
            // Only visible opponents or damage to the player can intensify the score.
            // Never expose hidden opponents through audio.
            if(b.Player.DamageTaken>lastDamage+.001f){lastDamage=b.Player.DamageTaken;combatUntil=b.Time+5f;}
            if(b.Time>=nextAssessment){
                nextAssessment=b.Time+.4f;
                foreach(var unit in b.Units){
                    if(unit.Team==b.Player.Team||unit.Kind==BattleTargetKind.Villager||!unit.State.Alive||
                        (unit.Position-b.Player.Position).sqrMagnitude>14f*14f||!b.IsVisibleTo(b.Player.Team,unit))continue;
                    combatUntil=b.Time+4f;break;
                }
            }
            Score(b.Time<combatUntil?1f:0f,musicGain);
            Loop(ambient,ambience,.20f*effectsGain*(1-.38f*combatMix));
            if(!entered){entered=true;if(entrance)stinger.PlayOneShot(entrance,.36f);}
        }
        public void Creature(WildernessKind kind,bool defeated,Vector3 position){
            if(!isActiveAndEnabled||!focused||appPaused||!view||!view.IsEditorReview||view.Paused||view.Battle==null||view.Battle.Finished||voices==null)return;
            var clips=defeated?defeats:attacks;int i=(int)kind;
            if(clips==null||i<0||i>=clips.Length||!clips[i])return;
            if(Vector3.Distance(view.FieldPosition(view.Battle.Player.Position),position)>38)return;
            var s=voices[next];next=(next+1)%voices.Length;s.Stop();s.transform.position=position;
            s.volume=ReviewAudioSettings.Get(ReviewAudioChannel.Effects);s.PlayOneShot(clips[i],defeated?.43f:.30f);
        }
        void StopAll(){if(music)music.Stop();if(combatScore)combatScore.Stop();if(ambient)ambient.Stop();if(stinger)stinger.Stop();StopSpatial();}
        void OnApplicationFocus(bool value){focused=value;if(!value)StopAll();}
        void OnApplicationPause(bool value){appPaused=value;if(value)StopAll();}
        void OnDisable(){StopAll();}
    }
}
