using UnityEngine;
namespace Buklod.Empire {
    // Presentation-only budgets. Combat simulation and targeting never depend on this.
    public static class BattleRenderBudget {
        public const float WarmRadius=32f, RetainRadius=38f, NearShadowRadius=18f, RetainShadowRadius=22f;
        public const int PoolLimit=64, PerPrefabPoolLimit=8;
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
