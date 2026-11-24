using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    // Pure, match-local rules ported from offline-moba/moba_sim.gd.
    public static class OfflineMatchRules {
        public const float MatchLimit = 900f;
        public const float AimDot = .72f;
        public const float AssistWindow=8f;
        public const int AssistGold=20;
        public static int TowerPriority(BattleTargetKind kind,bool retaliate) =>
            retaliate&&kind==BattleTargetKind.Hero?0:kind==BattleTargetKind.Minion?1:2;
        public static float TowerRamp(int previousHits) => 1f+.15f*Mathf.Clamp(previousHits,0,4);
        public static bool Retreat(float health, bool alreadyRetreating) =>
            health < .30f || (alreadyRetreating && health < .78f);
        public static bool CoreOpen(IEnumerable<bool> aliveNonTemporaryTowers) {
            foreach(bool alive in aliveNonTemporaryTowers) if(!alive) return true;
            return false;
        }
        public static bool InAimCone(Vector2 offset, Vector2 direction) =>
            direction.sqrMagnitude < .01f || offset.sqrMagnitude < .001f ||
            Vector2.Dot(direction.normalized,offset.normalized)>=AimDot;
        public static float AimScore(Vector2 offset, Vector2 direction) =>
            Vector2.Dot(direction.normalized,offset.normalized)*8f-offset.magnitude;
        public static float Damage(float value,bool blade,bool armor) =>
            Mathf.Max(0f,(value+(blade?7f:0f))*(armor?.88f:1f));
        public static float MoveSpeed(float speed,bool boots) => speed<10f&&boots?speed*1.18f:speed;
        public static int ShopPrice(string item) {
            switch(item) {
                case "blade":return 120;case "armor":return 110;case "boots":return 90;
                case "sealbreaker":return 190;case "withering_thorn":return 175;case "precision":return 200;
                case "fervor":return 170;case "renewal":return 180;case "wisdom":return 155;
                case "aegis":return 220;case "vitality":return 190;case "giantbane":return 210;default:return -1;
            }
        }
        public static bool TryBuy(string item, HashSet<string> owned, ref int gold, float distance, bool alive, bool active) {
            int price=ShopPrice(item);
            if(!active||!alive||price<0||owned==null||float.IsNaN(distance)||float.IsInfinity(distance)||distance<0||distance>12f||owned.Count>=6||owned.Contains(item)||gold<price) return false;
            owned.Add(item);gold-=price;return true;
        }
        public static bool TrySell(string item,HashSet<string> owned,ref int gold,float distance,bool alive,bool active){
            int price=ShopPrice(item);if(!alive||!active||owned==null||price<0||float.IsNaN(distance)||float.IsInfinity(distance)||distance<0||distance>12||!owned.Remove(item))return false;
            gold=Math.Min(9999,Math.Max(0,gold)+(int)(price*.6f));return true;
        }
        public static int KillGold(int consecutiveDeaths,int enemyStreak)=>Math.Max(25,75-10*Math.Max(0,Math.Min(5,consecutiveDeaths)))+Math.Min(100,Math.Max(0,enemyStreak-2)*20);
        public static float RespawnDelay(float now)=>Mathf.Clamp(7.5f+Mathf.Max(0,now)/60f,7.5f,22.5f);
        public static string TimeLimitWinner(float coreA,float coreB) => coreA>coreB?"A":coreB>coreA?"B":"";
    }
}
