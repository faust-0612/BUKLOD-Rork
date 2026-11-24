namespace Buklod.Empire {
    public enum ArenaTactic { Renew, SwiftPassage, DivineRefuge, CleansingLight, FinalStrike, SharedGrace, Pursuit, BindingSeal, GuardiansStand, BattleFervor, Rally, WildernessMastery }
    public static class ArenaTacticalRules {
        public static float Cooldown(ArenaTactic tactic){
            switch(tactic){
                case ArenaTactic.SwiftPassage:return 90;case ArenaTactic.DivineRefuge:return 75;
                case ArenaTactic.CleansingLight:return 95;case ArenaTactic.FinalStrike:return 90;
                case ArenaTactic.SharedGrace:return 75;case ArenaTactic.Pursuit:return 60;
                case ArenaTactic.BindingSeal:return 85;case ArenaTactic.GuardiansStand:return 80;
                case ArenaTactic.BattleFervor:return 70;case ArenaTactic.Rally:return 75;
                case ArenaTactic.WildernessMastery:return 65;case ArenaTactic.Renew:return 60;default:return -1;
            }
        }
    }
}
