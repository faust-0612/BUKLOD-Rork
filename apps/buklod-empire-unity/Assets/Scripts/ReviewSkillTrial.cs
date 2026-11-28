using System.Linq;
using UnityEngine;
namespace Buklod.Empire {
    // A fresh, disposable canonical offline simulation; never the active match
    // and never attached to LocalPracticeStore. Level six is explicit for skill review.
    public static class ReviewSkillTrial {
        public readonly struct Result {
            public readonly bool Accepted;public readonly string Enemy;public readonly float Damage,Healing,Shield,Displacement;public readonly int Summons;public readonly string Control;
            public Result(bool accepted,string enemy,float damage,float healing,float shield,float displacement,int summons,string control){
                Accepted=accepted;Enemy=enemy;Damage=damage;Healing=healing;Shield=shield;Displacement=displacement;Summons=summons;Control=control;
            }
            public string Summary=>!Accepted?"Level 6 lab • cast rejected in this setup":$"Lv 6 lab • DMG {Damage:0}  HEAL {Healing:0}  SHIELD {Shield:0}  DASH {Displacement:0.#}  SUMMON {Summons}"+(string.IsNullOrEmpty(Control)?"":"  "+Control);
        }
        public static Result Evaluate(string hero,SkillSlot slot){
            var trial=new OfflineBattle(hero,null,42,ArenaDifficulty.Normal,false);
            var player=trial.Player;var ally=trial.Units.First(u=>u!=player&&u.Team==player.Team&&u.Kind==BattleTargetKind.Hero);
            var enemy=trial.Units.First(u=>u.Team!=player.Team&&u.Kind==BattleTargetKind.Hero);
            var origin=new Vector2(145,25);player.Position=origin;ally.Position=origin+new Vector2(0,2);enemy.Position=origin+new Vector2(4,0);
            player.State.Level=6;player.State.Health=player.State.MaxHealth*.60f;ally.State.Health=ally.State.MaxHealth*.60f;
            float hp=player.State.Health+ally.State.Health,shield=player.State.Shield+ally.State.Shield;
            bool ok=trial.CastPlayer(slot,Vector2.right);
            float damage=Mathf.Max(0,player.DamageDealt);
            string cc=string.Join("/",new[]{"stun","slow","root","silence","disarm","blind","fear","weaken"}.Where(x=>enemy.State.Buff(x,trial.Time)>0));
            return new Result(ok,enemy.State.Kit.Id,damage,Mathf.Max(0,player.State.Health+ally.State.Health-hp),Mathf.Max(0,player.State.Shield+ally.State.Shield-shield),Vector2.Distance(origin,player.Position),trial.Units.Count(u=>u.Team==player.Team&&u.Temporary),cc);
        }
    }
}
