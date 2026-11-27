using System;
namespace Buklod.Empire {
    public enum ReviewMatchStage { Startup, Lobby, Mode, Team, Hero, Loadout, LockIn, Loading, InBattle }
    // Offline-only presentation state. No authority, inventory or rewards.
    public sealed class ReviewMatchFlow {
        public ReviewMatchStage Stage {get;private set;}=ReviewMatchStage.Startup;
        public bool InWizard=>(int)Stage>=(int)ReviewMatchStage.Mode&&(int)Stage<=(int)ReviewMatchStage.Loading;
        public bool BootReady(){if(Stage!=ReviewMatchStage.Startup)return false;Stage=ReviewMatchStage.Lobby;return true;}
        public bool Begin(){if(Stage!=ReviewMatchStage.Lobby&&Stage!=ReviewMatchStage.InBattle)return false;Stage=ReviewMatchStage.Mode;return true;}
        public bool Advance(){
            if((int)Stage<(int)ReviewMatchStage.Mode||(int)Stage>=(int)ReviewMatchStage.Loading)return false;
            Stage=(ReviewMatchStage)((int)Stage+1);return true;
        }
        public bool Back(){
            if((int)Stage<(int)ReviewMatchStage.Mode||(int)Stage>=(int)ReviewMatchStage.Loading)return false;
            Stage=Stage==ReviewMatchStage.Mode?ReviewMatchStage.Lobby:(ReviewMatchStage)((int)Stage-1);return true;
        }
        public bool CompleteLoading(){if(Stage!=ReviewMatchStage.Loading)return false;Stage=ReviewMatchStage.InBattle;return true;}
        public bool FailLoading(){if(Stage!=ReviewMatchStage.Loading)return false;Stage=ReviewMatchStage.LockIn;return true;}
        public bool ResumeBattle(){if(Stage!=ReviewMatchStage.Lobby&&Stage!=ReviewMatchStage.InBattle)return false;Stage=ReviewMatchStage.InBattle;return true;}
    }
}
