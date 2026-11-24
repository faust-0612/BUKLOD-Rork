using System;
namespace Buklod.Empire {
    public enum CovenantPath { Valor, Wisdom, Courage, Swiftness, Grace, Precision, Stewardship }
    // One choice per tier; all choices are free and match-local.
    public enum CovenantTalent { Fortitude, Focus, Agility, Resolve, Recovery, QuickCast, Precision, Sustenance, Steward }
    public readonly struct CovenantLoadout {
        public readonly CovenantPath Path;public readonly CovenantTalent First,Second,Third;
        public CovenantLoadout(CovenantPath path,CovenantTalent first,CovenantTalent second,CovenantTalent third){Path=path;First=first;Second=second;Third=third;}
    }
    public struct CovenantStats {
        public float Health,Mana,Speed,Damage,Mitigation,Cooldown,Recovery,AttackSpeed,Lifesteal,NeutralReward;
    }
    public static class CovenantPaths {
        public static bool TryResolve(CovenantLoadout loadout,out CovenantStats stats){
            stats=default;
            if(!Enum.IsDefined(typeof(CovenantPath),loadout.Path)||(int)loadout.First<0||(int)loadout.First>2||(int)loadout.Second<3||(int)loadout.Second>5||(int)loadout.Third<6||(int)loadout.Third>8)return false;
            switch(loadout.Path){
                case CovenantPath.Valor:stats.Damage=.06f;break;
                case CovenantPath.Wisdom:stats.Mana=12;stats.Cooldown=.04f;break;
                case CovenantPath.Courage:stats.Health=15;stats.Mitigation=.04f;break;
                case CovenantPath.Swiftness:stats.Speed=.06f;break;
                case CovenantPath.Grace:stats.Recovery=.10f;break;
                case CovenantPath.Precision:stats.AttackSpeed=.08f;break;
                case CovenantPath.Stewardship:stats.NeutralReward=.12f;break;
            }
            switch(loadout.First){case CovenantTalent.Fortitude:stats.Health+=10;break;case CovenantTalent.Focus:stats.Mana+=10;break;case CovenantTalent.Agility:stats.Speed+=.035f;break;}
            switch(loadout.Second){case CovenantTalent.Resolve:stats.Mitigation+=.035f;break;case CovenantTalent.Recovery:stats.Recovery+=.07f;break;case CovenantTalent.QuickCast:stats.Cooldown+=.035f;break;}
            switch(loadout.Third){case CovenantTalent.Precision:stats.AttackSpeed+=.05f;break;case CovenantTalent.Sustenance:stats.Lifesteal+=.05f;break;case CovenantTalent.Steward:stats.NeutralReward+=.10f;break;}
            return true;
        }
        public static CovenantLoadout DefaultFor(string hero){
            switch(hero){
                case "phan":case "van":case "angel":return new CovenantLoadout(CovenantPath.Courage,CovenantTalent.Fortitude,CovenantTalent.Resolve,CovenantTalent.Sustenance);
                case "ace":case "lhen":case "ellusur":return new CovenantLoadout(CovenantPath.Grace,CovenantTalent.Focus,CovenantTalent.Recovery,CovenantTalent.Sustenance);
                case "quin":case "jawo":return new CovenantLoadout(CovenantPath.Swiftness,CovenantTalent.Agility,CovenantTalent.QuickCast,CovenantTalent.Precision);
                case "christian":case "niel":return new CovenantLoadout(CovenantPath.Valor,CovenantTalent.Fortitude,CovenantTalent.Resolve,CovenantTalent.Precision);
                default:return new CovenantLoadout(CovenantPath.Wisdom,CovenantTalent.Focus,CovenantTalent.QuickCast,CovenantTalent.Steward);
            }
        }
    }
}
