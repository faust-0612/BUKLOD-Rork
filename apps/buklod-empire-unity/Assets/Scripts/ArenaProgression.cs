using System;
namespace Buklod.Empire {
    // Presentation only: never grants XP/BP or changes match combat attributes.
    public static class ArenaProgression {
        public const int DailyRewardMatches=5, DailyArenaBpCap=30;
        public static string Evolution(int level){
            if(level<1||level>20)throw new ArgumentOutOfRangeException(nameof(level));
            return level<5?"Awakening":level<10?"Emergence":level<15?"Ascension":level<20?"Transcendence":"Awakened Legend";
        }
        public static string TrainingResult(bool finished)=>finished?"TRAINING • 0 BP / 0 permanent XP • No stone spent":"";
    }
}
