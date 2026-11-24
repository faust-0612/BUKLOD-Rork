using System;
using System.Collections.Generic;

namespace Buklod.Empire {
    public enum VillageEffect { Build, Gather, Train, Heal, Research, Supply, Revive, Craft, Scavenge }
    public enum VillageItem { Heal, Shield, Boost, Bomb, Rage, ArmorBreak, Poison }
    public readonly struct VillageJob {
        public readonly string Id;
        public readonly VillageEffect Effect;
        public readonly double Interval;
        public VillageJob(string id,VillageEffect effect,double interval) { Id=id; Effect=effect; Interval=interval; }
    }
    // Scene adapter owns entity selection, animation and atomic application of effects.
    public interface IVillageBattle {
        int LowestTowerLevel(ArenaTeam team);
        bool UpgradeTower(ArenaTeam team,int expectedLevel,float hpFraction,float damageFraction);
        bool Deploy(ArenaTeam team,ArenaLane lane,int count,float power);
        bool HealNearBase(ArenaTeam team,float amount,float radiusSourceUnits);
        bool GiveItem(ArenaTeam team,VillageItem item,float power);
        bool CraftAtFront(ArenaTeam team,VillageItem item);
        int ReviveRecent(ArenaTeam team,int maxCount,float seconds,float healthFraction);
    }
    // Optional physical logistics adapter; standalone job tests may use the abstract economy.
    public interface IVillageLogistics {
        bool TryGather(ArenaTeam team,string workerId,double wood,double stone,double crystal);
    }
    public interface IVillageConstruction { bool HasConstructionOrder(ArenaTeam team); }
    public interface IVillageWorkGate { bool CanWork(ArenaTeam team,string workerId); }
    public sealed class VillageMember {
        public readonly VillageJob Job;
        public float Health { get; private set; }=200;
        public bool Alive => Health>0;
        public int Actions { get; private set; }
        public int Level => Math.Min(10,1+Actions/4);
        public float Power => 1+.10f*(Level-1);
        public string Stage => Level>=10?"Grand Village":Level>=5?"Village":"Hut";
        internal double Remaining, Respawn;
        internal VillageMember(VillageJob job) { Job=job; Remaining=job.Interval; }
        public void Damage(float amount) {
            if(float.IsNaN(amount)||float.IsInfinity(amount)||amount<0) throw new ArgumentOutOfRangeException(nameof(amount));
            if(!Alive)return;
            Health=Math.Max(0,Health-amount);
            if(!Alive)Respawn=60;
        }
        internal void Tick(double dt,bool canRespawn) {
            if(Alive){Remaining-=dt;return;}
            if(!canRespawn)return;
            Respawn-=dt;if(Respawn<=0){Health=100;Respawn=0;}
        }
        internal void Complete(bool success) {
            Remaining=Job.Interval/Power;
            if(success)Actions++;
        }
    }
    public sealed class VillageSystem {
        private static readonly VillageJob[] Lux={
            new VillageJob("aron",VillageEffect.Build,20),new VillageJob("lira",VillageEffect.Gather,5),
            new VillageJob("daren",VillageEffect.Train,45),new VillageJob("serah",VillageEffect.Heal,3),
            new VillageJob("kiel",VillageEffect.Research,30),new VillageJob("miko",VillageEffect.Supply,40)};
        private static readonly VillageJob[] Tenebra={
            new VillageJob("rogar",VillageEffect.Build,20),new VillageJob("velin",VillageEffect.Gather,5),
            new VillageJob("kael",VillageEffect.Train,45),new VillageJob("mora",VillageEffect.Revive,40),
            new VillageJob("zed",VillageEffect.Craft,50),new VillageJob("taro",VillageEffect.Scavenge,6)};
        private static readonly VillageItem[] Supply={VillageItem.Heal,VillageItem.Shield,VillageItem.Boost};
        private static readonly VillageItem[] Craft={VillageItem.Bomb,VillageItem.Rage,VillageItem.ArmorBreak,VillageItem.Poison};
        private readonly VillageMember[] members;
        private readonly MinionWaveDirector waves;
        private readonly IVillageBattle battle;
        private int lane,supply,craft;
        private double scavenged,accumulator;
        public ArenaTeam Team {get;}
        public IReadOnlyList<VillageMember> Members {get;}
        public double Wood {get;private set;}
        public double Stone {get;private set;}
        public double Crystal {get;private set;}
        public double Gold {get;private set;}
        public double Food {get;private set;}
        public const double ResourceCap=10000;
        public double ResourceBalance(VillageResourceKind kind){switch(kind){case VillageResourceKind.Wood:return Wood;case VillageResourceKind.Stone:return Stone;case VillageResourceKind.Crystal:return Crystal;case VillageResourceKind.Food:return Food;case VillageResourceKind.Gold:return Gold;default:return 0;}}
        public static double ResourceTarget(VillageResourceKind kind){switch(kind){case VillageResourceKind.Wood:return 65;case VillageResourceKind.Stone:return 40;case VillageResourceKind.Food:return 40;case VillageResourceKind.Crystal:return 30;case VillageResourceKind.Gold:return 25;default:return 1;}}
        internal double DepositResource(VillageResourceKind kind,double amount){
            if(!Enum.IsDefined(typeof(VillageResourceKind),kind)||double.IsNaN(amount)||double.IsInfinity(amount)||amount<=0)return 0;
            double added=Math.Max(0,Math.Min(amount,ResourceCap-ResourceBalance(kind)));
            switch(kind){case VillageResourceKind.Wood:Wood+=added;break;case VillageResourceKind.Stone:Stone+=added;break;case VillageResourceKind.Crystal:Crystal+=added;break;case VillageResourceKind.Food:Food+=added;break;case VillageResourceKind.Gold:Gold+=added;break;}return added;
        }
        public const double MarketLot=10,MarketBuyGold=15,MarketSellGold=6;
        internal bool TryMarketTrade(VillageResourceKind kind,bool buy){
            if(!Enum.IsDefined(typeof(VillageResourceKind),kind)||kind==VillageResourceKind.Gold)return false;
            double balance=ResourceBalance(kind);
            if(buy){if(Gold<MarketBuyGold||balance+MarketLot>ResourceCap)return false;Gold-=MarketBuyGold;DepositResource(kind,MarketLot);return true;}
            if(balance<MarketLot||Gold+MarketSellGold>ResourceCap)return false;
            switch(kind){case VillageResourceKind.Wood:Wood-=MarketLot;break;case VillageResourceKind.Stone:Stone-=MarketLot;break;case VillageResourceKind.Food:Food-=MarketLot;break;case VillageResourceKind.Crystal:Crystal-=MarketLot;break;}
            Gold+=MarketSellGold;return true;
        }
        internal double CreditPickup(string resource,double amount){
            if(double.IsNaN(amount)||double.IsInfinity(amount)||amount<=0)return 0;
            double current=resource=="wood"?Wood:resource=="stone"?Stone:resource=="gold"?Gold:-1;
            if(current<0)return 0;double added=Math.Max(0,Math.Min(amount,10000-current));
            if(resource=="wood")Wood+=added;else if(resource=="stone")Stone+=added;else Gold+=added;return added;
        }
        internal bool DepositCargo(double wood,double stone,double crystal){
            if(wood<0||stone<0||crystal<0||double.IsNaN(wood+stone+crystal)||double.IsInfinity(wood+stone+crystal))return false;
            if(Wood+wood>10000||Stone+stone>10000||Crystal+crystal>10000)return false;
            Wood+=wood;Stone+=stone;Crystal+=crystal;return true;
        }
        public int ResearchTier {get;private set;}
        public int TowersUpgraded {get;private set;}
        public int ItemsCrafted {get;private set;}
        public double Time {get;private set;}
        public VillageSystem(ArenaTeam team, MinionWaveDirector waves,IVillageBattle battle) {
            if(team!=ArenaTeam.Lux&&team!=ArenaTeam.Tenebra)throw new ArgumentOutOfRangeException(nameof(team));
            Team=team;this.waves=waves??throw new ArgumentNullException(nameof(waves));
            this.battle=battle??throw new ArgumentNullException(nameof(battle));
            var jobs=team==ArenaTeam.Lux?Lux:Tenebra;
            members=Array.ConvertAll(jobs,j=>new VillageMember(j)); Members=Array.AsReadOnly(members);
        }
        public VillageMember Find(string id) => Array.Find(members,m=>m.Job.Id==id);
        public void EnemyDefeated(bool structure) {
            if(!waves.Finished&&Time<OfflineMatchRules.MatchLimit&&Find("taro")?.Alive==true)
                scavenged+=structure?40:3;
        }
        // Fixed match-local steps: bounded by the 15-minute match; no reward settlement.
        public void Advance(double seconds) {
            if(double.IsNaN(seconds)||double.IsInfinity(seconds)||seconds<0)throw new ArgumentOutOfRangeException(nameof(seconds));
            if(waves.Finished||Time>=OfflineMatchRules.MatchLimit)return;
            const double step=.25;
            accumulator=Math.Min(accumulator+seconds,OfflineMatchRules.MatchLimit-Time);
            while(accumulator+1e-9>=step&&Time+step<=OfflineMatchRules.MatchLimit) {
                accumulator-=step;Time+=step;
                if(Time>=OfflineMatchRules.MatchLimit)break;
                foreach(var m in members) {
                    m.Tick(step,waves.CanReinforce(Team));
                    if(waves.Finished)break;
                    if(m.Alive&&m.Remaining<=0&&(!(battle is IVillageWorkGate gate)||gate.CanWork(Team,m.Job.Id)))m.Complete(Run(m));
                }
            }
        }
        private bool CanPay(double w,double s,double c)=>Wood>=w&&Stone>=s&&Crystal>=c;
        private static bool ConstructionCost(VillageBuildOrder kind,out double wood,out double stone){
            wood=stone=0;switch(kind){case VillageBuildOrder.Depot:wood=35;stone=20;return true;case VillageBuildOrder.GuardPost:wood=55;stone=40;return true;case VillageBuildOrder.Repair:wood=10;stone=5;return true;case VillageBuildOrder.Farm:wood=25;stone=5;return true;case VillageBuildOrder.Barracks:wood=60;stone=35;return true;case VillageBuildOrder.Market:wood=45;stone=25;return true;case VillageBuildOrder.House:wood=20;stone=10;return true;default:return false;}
        }
        internal bool CanFundConstruction(VillageBuildOrder kind)=>ConstructionCost(kind,out double w,out double s)&&CanPay(w,s,0);
        internal bool SpendConstruction(VillageBuildOrder kind){if(!ConstructionCost(kind,out double w,out double s)||!CanPay(w,s,0))return false;Pay(w,s,0);return true;}
        private void Pay(double w,double s,double c){Wood-=w;Stone-=s;Crystal-=c;}
        private bool FundJob(double gold,double wood,double stone,double crystal,Func<bool> action){
            bool useGold=Gold>=gold;if(!useGold&&!CanPay(wood,stone,crystal))return false;
            if(!action())return false;if(useGold)Gold-=gold;else Pay(wood,stone,crystal);return true;
        }
        private bool Run(VillageMember m) {
            float p=m.Power;bool lux=Team==ArenaTeam.Lux;
            switch(m.Job.Effect) {
                case VillageEffect.Gather:
                    double rate=(lux?1:1.4)*(m.Level>=5?1.2:1);
                    if(battle is IVillageLogistics logistics)return logistics.TryGather(Team,m.Job.Id,6*p*rate,4*p*rate,2*p*rate);
                    Wood=Math.Min(10000,Wood+6*p*rate);Stone=Math.Min(10000,Stone+4*p*rate);Crystal=Math.Min(10000,Crystal+2*p*rate);return true;
                case VillageEffect.Build:
                    if(battle is IVillageConstruction construction&&construction.HasConstructionOrder(Team))return false;
                    int level=battle.LowestTowerLevel(Team);
                    if(level<1||level>=5||!CanPay(40d*level,30d*level,0))return false;
                    if(!battle.UpgradeTower(Team,level,(lux ? .15f : .05f)*p,(lux ? .05f : .15f)*p))return false;
                    Pay(40d*level,30d*level,0);TowersUpgraded++;return true;
                case VillageEffect.Train:
                    double foodCost=battle is IVillageLogistics?(lux?12:10):0;
                    if(!CanPay(25,0,0)||Food<foodCost)return false;
                    if(!battle.Deploy(Team,(ArenaLane)(lane%3),lux?2:1,(lux?1:1.4f)*p*(1+.04f*ResearchTier)))return false;
                    Pay(25,0,0);Food-=foodCost;lane=(lane+1)%3;return true;
                case VillageEffect.Heal:return battle.HealNearBase(Team,25*p,700);
                case VillageEffect.Research:
                    if(ResearchTier>=5||!CanPay(0,0,20*(ResearchTier+1)))return false;
                    Pay(0,0,20*(ResearchTier+1));ResearchTier++;
                    waves.SetResearchBonus(Team,.04f*ResearchTier);return true;
                case VillageEffect.Supply:
                    var item=Supply[supply];if(!FundJob(12,8,0,4,()=>battle.GiveItem(Team,item,p)))return false;
                    supply=(supply+1)%Supply.Length;return true;
                case VillageEffect.Craft:
                    if(!FundJob(18,12,6,0,()=>battle.CraftAtFront(Team,Craft[craft])))return false;
                    craft=(craft+1)%Craft.Length;ItemsCrafted++;return true;
                case VillageEffect.Revive:
                    int affordable=Math.Min(2,(int)(Crystal/8));if(affordable<=0)return false;
                    int revived=battle.ReviveRecent(Team,affordable,25,.6f);if(revived<=0)return false;
                    Pay(0,0,8*Math.Min(affordable,revived));return true;
                case VillageEffect.Scavenge:
                    if(scavenged<=0)return false;
                    Wood=Math.Min(10000,Wood+scavenged*.5);Stone=Math.Min(10000,Stone+scavenged*.3);Crystal=Math.Min(10000,Crystal+scavenged*.2);scavenged=0;return true;
                default:return false;
            }
        }
    }
}
