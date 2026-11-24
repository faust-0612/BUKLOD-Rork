using System;
namespace Buklod.Empire {
    public enum VillageTechnology { Agriculture, Extraction, Logistics, Engineering, Military }
    public readonly struct TechnologyQuote {
        public readonly int Tier,Wood,Stone,Food,Crystal,Gold;
        public readonly float Seconds;
        public TechnologyQuote(int tier,int wood,int stone,int food,int crystal,int gold,float seconds){Tier=tier;Wood=wood;Stone=stone;Food=food;Crystal=crystal;Gold=gold;Seconds=seconds;}
    }
    public static class VillageTechnologyRules {
        public const int MaxTier=3;
        public static bool TryQuote(VillageTechnology tech,int current,out TechnologyQuote q){
            q=default;if(!Enum.IsDefined(typeof(VillageTechnology),tech)||current<0||current>=MaxTier)return false;
            int tier=current+1;float seconds=12+4*tier;
            switch(tech){
                case VillageTechnology.Agriculture:q=new TechnologyQuote(tier,20*tier,0,10*tier,8*tier,0,seconds);break;
                case VillageTechnology.Extraction:q=new TechnologyQuote(tier,15*tier,10*tier,0,10*tier,0,seconds);break;
                case VillageTechnology.Logistics:q=new TechnologyQuote(tier,20*tier,0,0,8*tier,8*tier,seconds);break;
                case VillageTechnology.Engineering:q=new TechnologyQuote(tier,20*tier,20*tier,0,10*tier,0,seconds);break;
                case VillageTechnology.Military:q=new TechnologyQuote(tier,15*tier,0,20*tier,15*tier,0,seconds);break;
            }return q.Tier>0;
        }
        private static int Tier(int tier)=>Math.Max(0,Math.Min(MaxTier,tier));
        public static double CargoCapacity(int tier)=>36+8*Tier(tier);
        public static double HarvestMultiplier(int tier)=>1+.12*Tier(tier);
        public static double FarmRegrowth(int tier)=>12+4*Tier(tier);
        public static float WorkerSpeed(int tier)=>4*(1+.08f*Tier(tier));
        public static float BuildSpeed(int tier)=>1+.10f*Tier(tier);
        public static float MilitaryPower(int tier)=>1+.04f*Tier(tier);
    }
}
