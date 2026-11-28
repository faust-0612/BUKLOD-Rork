using UnityEngine;
namespace Buklod.Empire {
    // Presentation-only budgets. Combat simulation and targeting never depend on this.
    public static class BattleRenderBudget {
        public const float WarmRadius=32f, RetainRadius=38f, NearShadowRadius=18f, RetainShadowRadius=22f;
        public const int PoolLimit=64, PerPrefabPoolLimit=8, DeathVisualLimit=16;
        public const float HeroDetailEnter=12f,HeroDetailRetain=15f;
        // Retain full detail for the local hero and nearby visible actors; allow the
        // imported LODGroup to choose based on projected size elsewhere.
        public static int ReviewHeroLod(bool premium,bool player,bool visible,int previous,float distanceSquared){
            if(!premium)return -1;
            if(player)return 0;
            float radius=previous==0?HeroDetailRetain:HeroDetailEnter;
            return visible&&distanceSquared<=radius*radius?0:-1;
        }
        public static bool CanRetire(int count)=>count>=0&&count<DeathVisualLimit;
        public static bool RetainVisual(bool player,bool intersectsFrustum,bool alreadyActive,float distanceSquared){
            float radius=alreadyActive?RetainRadius:WarmRadius;
            return player||intersectsFrustum||distanceSquared<=radius*radius;
        }
        public static bool KeepShadow(bool player,bool alreadyOn,float distanceSquared){
            float radius=alreadyOn?RetainShadowRadius:NearShadowRadius;
            return player||distanceSquared<=radius*radius;
        }
        public static bool CanPool(int total,int perPrefab)=>total<PoolLimit&&perPrefab<PerPrefabPoolLimit;
    }
}
