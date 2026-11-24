using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    // Pure, match-local rules ported from offline-moba/moba_sim.gd.
    public static class OfflineMatchRules {
        public const float MatchLimit = 900f;
        public const float AimDot = .72f;
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
            switch(item) {case "blade":return 120;case "armor":return 110;case "boots":return 90;default:return -1;}
        }
        public static bool TryBuy(string item, HashSet<string> owned, ref int gold, float distance, bool alive, bool active) {
            int price=ShopPrice(item);
            if(!active||!alive||price<0||distance>12f||owned.Count>=3||owned.Contains(item)||gold<price) return false;
            owned.Add(item);gold-=price;return true;
        }
        public static string TimeLimitWinner(float coreA,float coreB) => coreA>coreB?"A":coreB>coreA?"B":"";
    }
}
