using System;
namespace Buklod.Empire {
    // Presentation only: never grants XP/BP or changes match combat attributes.
    public static class ArenaProgression {
        public const int DailyRewardMatches=5, DailyArenaBpCap=30;
        public static string Evolution(int level){
            if(level<1||level>20)throw new ArgumentOutOfRangeException(nameof(level));
            return level<5?"Awakening":level<10?"Emergence":level<15?"Ascension":level<20?"Transcendence":"Awakened Legend";
        }
        // Review look selection is not a character level, eligibility check or ownership receipt.
        public static int NextPreviewLevel(int level){
            switch(level){case 1:return 5;case 5:return 10;case 10:return 15;case 15:return 20;case 20:return 1;default:throw new ArgumentOutOfRangeException(nameof(level));}
        }
        public static int PreviewStage(int level){
            switch(level){case 1:return 0;case 5:return 1;case 10:return 2;case 15:return 3;case 20:return 4;default:throw new ArgumentOutOfRangeException(nameof(level));}
        }
        public static string TrainingResult(bool finished)=>finished?"TRAINING • 0 BP / 0 permanent XP • No stone spent":"";
    }
}
