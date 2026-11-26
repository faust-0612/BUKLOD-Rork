using UnityEngine;
namespace Buklod.Empire {
    // Authored foley and one-shot English announcer; presentation only.
    // No client-side reward creation or hidden-opponent information.
    public sealed class ArenaReviewFoley:MonoBehaviour {
        public AudioClip[] steps;
        public AudioClip metal,wood,coins,fight,win,lose,draw;
        BattleView view;OfflineBattle match;
        AudioSource feet,announcer,economy;
        AudioSource[] hits;
        int nextHit,nextStep,lastGold;bool entered,finished,focused=true,appPaused;
        Vector2 previous;float stride,nextImpact,nextCoin;
        AudioSource Source(string name,bool spatial){
            var go=new GameObject(name);go.transform.SetParent(transform,false);
            var s=go.AddComponent<AudioSource>();s.playOnAwake=false;s.spatialBlend=spatial?1:0;s.dopplerLevel=0;
            s.rolloffMode=AudioRolloffMode.Linear;s.minDistance=3;s.maxDistance=25;return s;
        }
        void Awake(){
            view=GetComponent<BattleView>();
            if(!view||!view.IsEditorReview){enabled=false;return;}
            feet=Source("Authored footsteps",false);announcer=Source("Match announcer",false);economy=Source("Economy feedback",false);
            hits=new AudioSource[4];for(int i=0;i<hits.Length;i++)hits[i]=Source("Impact voice "+i,true);
        }
        bool Active=>isActiveAndEnabled&&focused&&!appPaused&&view&&view.IsEditorReview&&view.Battle!=null;
        void Speak(AudioClip clip){if(clip&&announcer){announcer.Stop();announcer.PlayOneShot(clip,.62f);}}
        void StopAll(){if(feet)feet.Stop();if(announcer)announcer.Stop();if(economy)economy.Stop();if(hits!=null)foreach(var s in hits)s.Stop();}
        void Update(){
            if(!Active||!feet)return;
            var b=view.Battle;var player=b.Player;
            if(match!=b){StopAll();match=b;entered=finished=false;previous=player.Position;stride=0;lastGold=player.Gold;nextCoin=nextImpact=0;}
            if(b.Finished){
                if(!finished){finished=true;StopAll();Speak(!b.Winner.HasValue?draw:b.Winner.Value==player.Team?win:lose);}
                return;
            }
            if(view.Paused){previous=player.Position;lastGold=player.Gold;stride=0;if(feet.isPlaying)feet.Stop();return;}
            if(!entered){entered=true;Speak(fight);}
            float delta=Vector2.Distance(previous,player.Position);previous=player.Position;
            if(player.State.Alive&&delta<2f){stride+=delta;if(stride>=1.3f){stride%=1.3f;if(steps!=null&&steps.Length>0&&!feet.isPlaying){var clip=steps[nextStep++%steps.Length];if(clip)feet.PlayOneShot(clip,.22f);}}}
            else stride=0;
            if(player.Gold>lastGold&&Time.unscaledTime>=nextCoin&&coins){economy.PlayOneShot(coins,.16f);nextCoin=Time.unscaledTime+1.2f;}
            lastGold=player.Gold;
        }
        public void Impact(bool structure,Vector3 point){
            if(!Active||view.Paused||view.Battle.Finished||hits==null||Time.unscaledTime<nextImpact)return;
            if(Vector3.Distance(view.FieldPosition(view.Battle.Player.Position),point)>20)return;
            var clip=structure?wood:metal;if(!clip)return;
            var s=hits[nextHit++%hits.Length];s.Stop();s.transform.position=point;s.PlayOneShot(clip,.22f);nextImpact=Time.unscaledTime+.12f;
        }
        void OnApplicationFocus(bool value){focused=value;if(!value)StopAll();}
        void OnApplicationPause(bool value){appPaused=value;if(value)StopAll();}
        void OnDisable(){StopAll();}
    }
}
