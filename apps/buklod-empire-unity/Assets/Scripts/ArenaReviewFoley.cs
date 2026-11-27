using UnityEngine;
namespace Buklod.Empire {
    // Authored foley and one-shot English announcer; presentation only.
    // No client-side reward creation or hidden-opponent information.
    public sealed class ArenaReviewFoley:MonoBehaviour {
        public AudioClip[] steps;
        public AudioClip metal,wood,coins,fight,win,lose,draw,levelUp;
        BattleView view;OfflineBattle match;
        AudioSource feet,announcer,economy,work,playerAttack,progression;
        AudioSource[] alliedAttacks;int nextAttack;float nextOtherAttack;
        AudioSource[] hits;
        int nextHit,nextStep,lastEarned,lastLevel;bool entered,finished,focused=true,appPaused;
        Vector2 previous;float stride,nextImpact,nextCoin;
        AudioSource Source(string name,bool spatial){
            var go=new GameObject(name);go.transform.SetParent(transform,false);
            var s=go.AddComponent<AudioSource>();s.playOnAwake=false;s.spatialBlend=spatial?1:0;s.dopplerLevel=0;
            s.rolloffMode=AudioRolloffMode.Linear;s.minDistance=3;s.maxDistance=25;return s;
        }
        void Awake(){
            view=GetComponent<BattleView>();
            if(!view||!view.IsEditorReview){enabled=false;return;}
            feet=Source("Authored footsteps",false);announcer=Source("Match announcer",false);economy=Source("Economy feedback",false);work=Source("Village work foley",true);progression=Source("Library level-up feedback",false);
            hits=new AudioSource[4];for(int i=0;i<hits.Length;i++)hits[i]=Source("Impact voice "+i,true);
            playerAttack=Source("Player weapon foley",false);alliedAttacks=new AudioSource[3];for(int i=0;i<alliedAttacks.Length;i++)alliedAttacks[i]=Source("Nearby weapon foley "+i,true);
        }
        bool Active=>isActiveAndEnabled&&focused&&!appPaused&&view&&view.IsEditorReview&&view.Battle!=null;
        void Speak(AudioClip clip){if(clip&&announcer){announcer.Stop();announcer.PlayOneShot(clip,.62f);}}
        void StopAll(bool preserveResult=false){if(feet)feet.Stop();if(announcer&&!preserveResult)announcer.Stop();if(economy)economy.Stop();if(progression)progression.Stop();if(work)work.Stop();if(hits!=null)foreach(var s in hits)s.Stop();if(playerAttack)playerAttack.Stop();if(alliedAttacks!=null)foreach(var s in alliedAttacks)s.Stop();}
        void Update(){
            if(!Active||!feet)return;
            var b=view.Battle;var player=b.Player;
            float effects=ReviewAudioSettings.Get(ReviewAudioChannel.Effects);
            feet.volume=effects;economy.volume=effects;progression.volume=effects;work.volume=effects;announcer.volume=ReviewAudioSettings.Get(ReviewAudioChannel.Voice);
            foreach(var hit in hits)hit.volume=effects;
            if(playerAttack)playerAttack.volume=effects;foreach(var attack in alliedAttacks)attack.volume=effects;
            if(match!=b){StopAll();match=b;entered=finished=false;previous=player.Position;stride=0;lastEarned=player.EarnedFeedbackSequence;lastLevel=player.State.Level;nextCoin=nextImpact=nextOtherAttack=0;nextAttack=0;}
            if(b.Finished){
                if(!finished){finished=true;StopAll();Speak(!b.Winner.HasValue?draw:b.Winner.Value==player.Team?win:lose);}
                return;
            }
            if(view.Paused){previous=player.Position;lastEarned=player.EarnedFeedbackSequence;lastLevel=player.State.Level;stride=0;StopAll();return;}
            if(!entered){entered=true;Speak(fight);}
            float delta=Vector2.Distance(previous,player.Position);previous=player.Position;
            if(player.State.Alive&&delta<2f){stride+=delta;if(stride>=1.3f){stride%=1.3f;if(steps!=null&&steps.Length>0&&!feet.isPlaying){var clip=steps[nextStep++%steps.Length];if(clip)feet.PlayOneShot(clip,.22f);}}}
            else stride=0;
            if(player.EarnedFeedbackSequence>lastEarned&&Time.unscaledTime>=nextCoin&&coins){economy.PlayOneShot(coins,.16f);nextCoin=Time.unscaledTime+1.2f;}
            lastEarned=player.EarnedFeedbackSequence;
            // Actual accepted match-state transition, never an XP/BP grant.
            if(player.State.Level>lastLevel&&levelUp){progression.Stop();progression.PlayOneShot(levelUp,.28f);}
            lastLevel=player.State.Level;
        }
        public void SuspendBattleAudio(){StopAll(finished&&view&&view.Battle==match&&match!=null&&match.Finished);stride=0;if(view&&view.Battle!=null){previous=view.Battle.Player.Position;lastEarned=view.Battle.Player.EarnedFeedbackSequence;lastLevel=view.Battle.Player.State.Level;}}
        // Emit only for an accepted attack from a currently presented hero.
        // The player gets a dedicated voice; nearby heroes share a bounded pool.
        public void WeaponAttack(string hero,Vector3 point,bool player){
            if(!Active||view.Paused||view.Battle.Finished||!playerAttack||alliedAttacks==null)return;
            if(!player&&(Vector3.Distance(view.FieldPosition(view.Battle.Player.Position),point)>18||Time.unscaledTime<nextOtherAttack))return;
            var cue=ReviewWeaponProfiles.Audio(hero);var clip=cue.Wood?wood:metal;if(!clip)return;
            AudioSource source;
            if(player)source=playerAttack;
            else{source=alliedAttacks[nextAttack++%alliedAttacks.Length];nextOtherAttack=Time.unscaledTime+.16f;}
            source.Stop();source.transform.position=point;source.pitch=cue.Pitch;
            source.volume=ReviewAudioSettings.Get(ReviewAudioChannel.Effects);
            source.PlayOneShot(clip,player?.17f:.11f);
        }
        public void Work(Vector3 point){
            if(!Active||view.Paused||view.Battle.Finished||!work||!wood||work.isPlaying)return;
            if(Vector3.Distance(view.FieldPosition(view.Battle.Player.Position),point)>20)return;
            work.transform.position=point;work.PlayOneShot(wood,.15f);
        }
        public void Impact(bool structure,Vector3 point){
            if(!Active||view.Paused||hits==null||Time.unscaledTime<nextImpact)return;
            if(Vector3.Distance(view.FieldPosition(view.Battle.Player.Position),point)>20)return;
            var clip=structure?wood:metal;if(!clip)return;
            var s=hits[nextHit++%hits.Length];s.Stop();s.transform.position=point;s.PlayOneShot(clip,.22f);nextImpact=Time.unscaledTime+.12f;
        }
        void OnApplicationFocus(bool value){focused=value;if(!value)StopAll();}
        void OnApplicationPause(bool value){appPaused=value;if(value)StopAll();}
        void OnDisable(){StopAll();}
    }
}
