using UnityEngine;
namespace Buklod.Empire {
    // Result presentation never determines outcome or writes rewards.
    public static class ReviewResultPresentation {
        public static string Outcome(ArenaTeam player,ArenaTeam? winner)=>!winner.HasValue?"DRAW":winner.Value==player?"VICTORY":"DEFEAT";
        public static string Faction(ArenaTeam? winner)=>!winner.HasValue?"BATTLE DRAWN":winner.Value==ArenaTeam.Lux?"LUX PREVAILS":"TENEBRA PREVAILS";
        public static float Reveal(float elapsed,float delay){
            float t=Mathf.Clamp01((elapsed-delay)/.45f);return 1-Mathf.Pow(1-t,3);
        }
    }
}
