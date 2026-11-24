using System;
using System.Collections.Generic;
namespace Buklod.Empire {
    public enum BattleTargetKind { Minion, Structure, Hero, Villager }
    public readonly struct MinionStats {
        public readonly float Health, Damage, SpeedSourceUnits, RangeSourceUnits, Cooldown, Defense, SplashRadiusSourceUnits, StructureMultiplier, HealAmount;
        public MinionStats(float hp,float dmg,float speed,float range,float cooldown,float defense,float splash=0,float structureMultiplier=1,float heal=0) {
            Health=hp;Damage=dmg;SpeedSourceUnits=speed;RangeSourceUnits=range;Cooldown=cooldown;Defense=defense;
            SplashRadiusSourceUnits=splash;StructureMultiplier=structureMultiplier;HealAmount=heal;
        }
    }
    public readonly struct BattleTarget {
        public readonly int Id;
        public readonly ArenaTeam Team;
        public readonly BattleTargetKind Kind;
        public readonly float Distance, MissingHealth;
        public readonly bool Alive, Attackable;
        public BattleTarget(int id,ArenaTeam team,BattleTargetKind kind,float distance,bool alive,bool attackable,float missingHealth=0) {
            Id=id;Team=team;Kind=kind;Distance=distance;Alive=alive;Attackable=attackable;MissingHealth=missingHealth;
        }
    }
    // Original Godot tuning in source units; scene adapter converts distances to world metres.
    public static class MinionCombatRules {
        public static MinionStats Stats(MinionRole role) {
            switch(role) {
                case MinionRole.Infantry:return new MinionStats(320,18,90,42,1,.10f);
                case MinionRole.Mage:return new MinionStats(190,34,90,230,1.6f,0,70);
                case MinionRole.Gunner:return new MinionStats(200,22,105,270,.9f,0);
                case MinionRole.Siege:return new MinionStats(700,30,60,170,2.2f,.20f,0,3);
                case MinionRole.Healer:return new MinionStats(300,0,80,170,1.5f,0,heal:20);
                default:throw new ArgumentOutOfRangeException(nameof(role));
            }
        }
        private static int Priority(MinionRole role,BattleTargetKind kind) {
            if(kind==BattleTargetKind.Hero)return 2;
            if(role==MinionRole.Siege)return kind==BattleTargetKind.Structure?0:1;
            return kind==BattleTargetKind.Minion?0:1;
        }
        public static BattleTarget? Select(MinionRole role,ArenaTeam team,IEnumerable<BattleTarget> candidates,float rangeSourceUnits) {
            if(float.IsNaN(rangeSourceUnits)||float.IsInfinity(rangeSourceUnits)||rangeSourceUnits<0)throw new ArgumentOutOfRangeException(nameof(rangeSourceUnits));
            BattleTarget? best=null;
            bool heal=role==MinionRole.Healer;
            foreach(var t in candidates) {
                if(!t.Alive||t.Distance<0||float.IsNaN(t.Distance)||t.Distance>rangeSourceUnits)continue;
                if(heal ? t.Team!=team||t.Kind!=BattleTargetKind.Minion||!(t.MissingHealth>0) : t.Team==team||!t.Attackable)continue;
                if(!best.HasValue){best=t;continue;}
                var b=best.Value;
                int p=Priority(role,t.Kind),bp=Priority(role,b.Kind);
                if(p<bp||p==bp&&(t.Distance<b.Distance||t.Distance==b.Distance&&t.Id<b.Id))best=t;
            }
            return best;
        }
        public static float HitDamage(MinionRole role,float power,BattleTargetKind target,float defense) {
            if(float.IsNaN(power)||float.IsInfinity(power)||power<0||float.IsNaN(defense)||float.IsInfinity(defense))throw new ArgumentOutOfRangeException();
            var s=Stats(role);
            return s.Damage*power*(target==BattleTargetKind.Structure?s.StructureMultiplier:1)*(1-Math.Max(0,Math.Min(1,defense)));
        }
    }
}
