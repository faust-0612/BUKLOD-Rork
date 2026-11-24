using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
namespace Buklod.Empire {
    public enum VillageWorkerOrder { Gather, Return, Hold }
    public enum VillageBuildOrder { Depot, GuardPost, Repair }
    public sealed class VillageConstructionOrder {
        public readonly VillageBuildOrder Kind;public readonly Vector2 Position;public readonly int TargetId;
        public float Progress {get;internal set;}
        internal VillageConstructionOrder(VillageBuildOrder kind,Vector2 position,int targetId=0){Kind=kind;Position=position;TargetId=targetId;}
    }
    public sealed class VillageResourceNode {
        public readonly ArenaTeam Team;
        public readonly Vector2 Position;
        public double Wood {get;internal set;}=1800;
        public double Stone {get;internal set;}=1200;
        public double Crystal {get;internal set;}=600;
        internal VillageResourceNode(ArenaTeam team,Vector2 position){Team=team;Position=position;}
    }
    public sealed class BattleUnit {
        public readonly int Id; public readonly ArenaTeam Team; public readonly BattleTargetKind Kind;
        public readonly SkillActor State; public readonly ArenaLane Lane;
        public readonly bool Core, Temporary; public readonly MinionRole Role;
        public bool IsDepot {get;internal set;} public bool IsGuardPost {get;internal set;}
        public VillageConstructionOrder Construction {get;internal set;}
        public readonly Vector2 Spawn; public Vector2 Position {get;internal set;}
        public float Power=1, AttackDamage=18, Expires=float.PositiveInfinity, RespawnAt, Xp;
        public int Gold=120, TowerLevel=1;
        public int Kills {get;internal set;} public int Deaths {get;internal set;} public int Assists {get;internal set;}
        internal int AggressorId, LastTowerTarget, ConsecutiveTowerHits,KillStreak,ConsecutiveDeaths;
        public float DamageDealt {get;internal set;} public float DamageTaken {get;internal set;}
        internal float AggroUntil;
        internal readonly Dictionary<int,float> RecentHeroDamage=new Dictionary<int,float>();
        public float TowerDamageMultiplier=1;
        public VillageMember Villager {get;internal set;}
        public VillageWorkerOrder WorkerOrder {get;internal set;}=VillageWorkerOrder.Gather;
        public double CargoWood {get;internal set;} public double CargoStone {get;internal set;} public double CargoCrystal {get;internal set;}
        public double Cargo=>CargoWood+CargoStone+CargoCrystal;
        public bool Retreat; public float LastAttack=float.NegativeInfinity;
        public ArenaTactic Tactic {get;internal set;}=ArenaTactic.Renew;
        public float TacticReadyAt {get;internal set;}
        public float RecallEnds {get;internal set;}
        public bool IsRecalling=>RecallEnds>0;
        internal bool Jungler;
        internal int ResolveStacks,RhythmStacks,TriageSeen;
        internal float ResolveAt,TrailReady,RhythmAt=float.NegativeInfinity,HarmonyAt,TriageUntil;
        internal bool TriageUsed;
        internal Vector2 TriageOrigin;
        public readonly HashSet<string> Gear=new HashSet<string>();
        internal readonly Dictionary<string,ArenaRelicDefinition> RelicSlots=new Dictionary<string,ArenaRelicDefinition>();
        public IReadOnlyDictionary<string,ArenaRelicDefinition> Relics {get;}
        internal ArenaRelicStats RelicStats;
        internal readonly Dictionary<int,int> HeroKillHistory=new Dictionary<int,int>();
        internal BattleUnit(int id,ArenaTeam team,BattleTargetKind kind,SkillActor state,Vector2 pos,ArenaLane lane,bool core=false,bool temporary=false,MinionRole role=MinionRole.Infantry){
            Id=id;Team=team;Kind=kind;State=state;Spawn=Position=pos;Lane=lane;Core=core;Temporary=temporary;Role=role;Relics=new System.Collections.ObjectModel.ReadOnlyDictionary<string,ArenaRelicDefinition>(RelicSlots);
        }
    }
    // Match-local Unity C# simulation. Original Genesis Rift size and cover. Rendering,
    // NavMesh and village adapter are separate integration tasks; no persistent economy.
    public interface IBattleNavigation {
        bool CanTraverse(Vector2 from,Vector2 to);
        bool TryWaypoint(Vector2 from,Vector2 goal,out Vector2 waypoint);
    }
    public sealed class OfflineBattle : IHeroSkillWorld, IVillageBattle, IVillageLogistics, IVillageConstruction {
        public const float Width=320, Height=220, Step=.1f;
        private static readonly float[] LaneY={Height*.19f,Height*.5f,Height*.81f};
        private static readonly Vector3[] OriginalCover={
            new Vector3(.29f,.23f,.025f),new Vector3(.71f,.77f,.025f),new Vector3(.42f,.41f,.025f),
            new Vector3(.58f,.59f,.025f),new Vector3(.48f,.81f,.018f),new Vector3(.52f,.19f,.018f)};
        private readonly List<BattleUnit> units=new List<BattleUnit>();
        private readonly Dictionary<SkillActor,BattleUnit> byState=new Dictionary<SkillActor,BattleUnit>();
        private readonly List<(Vector2 position,float radius,float expires)> cover=new List<(Vector2,float,float)>();
        private readonly MinionWaveDirector waves=new MinionWaveDirector();
        private readonly NeutralObjectiveDirector wilderness=new NeutralObjectiveDirector();
        public IReadOnlyList<WildernessCamp> Camps=>wilderness.Camps;
        private static readonly Vector3[] Concealment={new Vector3(.25f,.38f,.022f),new Vector3(.75f,.62f,.022f),new Vector3(.40f,.73f,.02f),new Vector3(.60f,.27f,.02f)};
        private readonly VillageSystem[] villages=new VillageSystem[2];
        private readonly List<VillageResourceNode> resourceNodes=new List<VillageResourceNode>();
        public IReadOnlyList<VillageResourceNode> ResourceNodes=>resourceNodes.AsReadOnly();
        private const double CargoLimit=36;
        private VillageResourceNode WorkerNode(BattleUnit u)=>resourceNodes.Where(n=>n.Team==u.Team&&n.Wood+n.Stone+n.Crystal>0).OrderBy(n=>Vector2.Distance(n.Position,u.Position)).FirstOrDefault();
        public bool OrderPlayerWorker(string id,VillageWorkerOrder order){
            if(Finished||Time>=OfflineMatchRules.MatchLimit||!Enum.IsDefined(typeof(VillageWorkerOrder),order))return false;
            var worker=units.FirstOrDefault(u=>u.Team==Player.Team&&u.State.Alive&&u.Villager?.Job.Id==id&&u.Villager.Job.Effect==VillageEffect.Gather);
            if(worker==null)return false;worker.WorkerOrder=order;return true;
        }
        public bool TryGather(ArenaTeam team,string workerId,double wood,double stone,double crystal){
            if(Finished||Time>=OfflineMatchRules.MatchLimit||wood<0||stone<0||crystal<0||double.IsNaN(wood+stone+crystal)||double.IsInfinity(wood+stone+crystal))return false;
            var u=units.FirstOrDefault(x=>x.Team==team&&x.State.Alive&&x.Villager?.Alive==true&&x.Villager.Job.Id==workerId&&x.Villager.Job.Effect==VillageEffect.Gather);
            if(u==null||u.WorkerOrder!=VillageWorkerOrder.Gather)return false;
            var n=WorkerNode(u);if(n==null||Vector2.Distance(n.Position,u.Position)>2.5f)return false;
            double total=wood+stone+crystal,scale=total<=0?0:Math.Min(1,Math.Max(0,CargoLimit-u.Cargo)/total);
            double w=Math.Min(n.Wood,wood*scale),s=Math.Min(n.Stone,stone*scale),c=Math.Min(n.Crystal,crystal*scale);
            if(w+s+c<=0)return false;
            n.Wood-=w;n.Stone-=s;n.Crystal-=c;u.CargoWood+=w;u.CargoStone+=s;u.CargoCrystal+=c;
            if(u.Cargo>=CargoLimit-.001||n.Wood+n.Stone+n.Crystal<=0)u.WorkerOrder=VillageWorkerOrder.Return;
            return true;
        }
        private BattleUnit Builder(ArenaTeam team)=>units.FirstOrDefault(u=>u.Team==team&&u.Villager?.Job.Effect==VillageEffect.Build&&u.State.Alive);
        private BattleUnit Depot(BattleUnit worker)=>units.Where(u=>u.Team==worker.Team&&u.State.Alive&&(u.Core||u.IsDepot)).OrderBy(u=>Dist(worker,u)).ThenBy(u=>u.Id).FirstOrDefault();
        public bool HasConstructionOrder(ArenaTeam team)=>Builder(team)?.Construction!=null;
        private bool CanConstructAt(ArenaTeam team,VillageBuildOrder kind,Vector2 p){
            if(!Finite(p)||Blocked(p,2)||kind!=VillageBuildOrder.Depot&&kind!=VillageBuildOrder.GuardPost)return false;
            if((team==ArenaTeam.Lux?p.x>Width*.48f:p.x<Width*.52f)||Vector2.Distance(Base(team),p)>65)return false;
            if(units.Any(u=>u.Kind==BattleTargetKind.Structure&&u.State.Alive&&Vector2.Distance(u.Position,p)<5))return false;
            if(resourceNodes.Any(n=>Vector2.Distance(n.Position,p)<4))return false;
            return units.Count(u=>u.Team==team&&u.State.Alive&&(kind==VillageBuildOrder.Depot?u.IsDepot:u.IsGuardPost))<2;
        }
        private bool QueueConstruction(ArenaTeam team,VillageBuildOrder kind,Vector2 p,int targetId=0){
            if(Finished||Time>=OfflineMatchRules.MatchLimit)return false;
            var builder=Builder(team);if(builder==null||builder.Construction!=null)return false;
            if(kind==VillageBuildOrder.Repair){
                var target=units.FirstOrDefault(u=>u.Id==targetId&&u.Team==team&&u.Kind==BattleTargetKind.Structure&&!u.Temporary&&u.State.Alive&&u.State.Health<u.State.MaxHealth);
                if(target==null)return false;p=target.Position;
            }else if(!CanConstructAt(team,kind,p))return false;
            if(!villages[(int)team].CanFundConstruction(kind))return false;
            builder.Construction=new VillageConstructionOrder(kind,p,targetId);return true;
        }
        public bool OrderPlayerConstruction(VillageBuildOrder kind,Vector2 position)=>kind!=VillageBuildOrder.Repair&&QueueConstruction(Player.Team,kind,position);
        public bool OrderPlayerRepair(int structureId)=>QueueConstruction(Player.Team,VillageBuildOrder.Repair,Vector2.zero,structureId);
        public bool CancelPlayerConstruction(){var builder=Builder(Player.Team);if(Finished||builder?.Construction==null)return false;builder.Construction=null;return true;}
        private void AdvanceConstruction(){
            if(Time>=OfflineMatchRules.MatchLimit){foreach(var u in units)if(u.Construction!=null)u.Construction=null;return;}
            // Defensive RTS bot: one queued job at a time; never spends without a completed action.
            if(tick%20==0){
                var bot=Builder(ArenaTeam.Tenebra);
                if(bot!=null&&bot.Construction==null){
                    var damaged=units.Where(u=>u.Team==bot.Team&&u.Kind==BattleTargetKind.Structure&&!u.Temporary&&u.State.Alive&&u.State.Health<u.State.MaxHealth*.75f).OrderBy(u=>u.State.Health/u.State.MaxHealth).ThenBy(u=>u.Id).FirstOrDefault();
                    if(damaged!=null)QueueConstruction(bot.Team,VillageBuildOrder.Repair,damaged.Position,damaged.Id);
                    else if(!CoreAlive(bot.Team)&&Depot(bot)==null)QueueConstruction(bot.Team,VillageBuildOrder.Depot,Base(bot.Team)+new Vector2(-8,-8));
                }
            }
            foreach(var builder in units.Where(u=>u.Construction!=null).ToArray()){
                var order=builder.Construction;
                if(!builder.State.Alive){builder.Construction=null;continue;}
                BattleUnit target=null;
                if(order.Kind==VillageBuildOrder.Repair){
                    target=units.FirstOrDefault(u=>u.Id==order.TargetId&&u.Team==builder.Team&&u.State.Alive&&u.State.Health<u.State.MaxHealth);
                    if(target==null){builder.Construction=null;continue;}
                }else if(!CanConstructAt(builder.Team,order.Kind,order.Position)){builder.Construction=null;continue;}
                if(!builder.State.CanMove(Time)||!builder.State.CanCast(Time))continue;
                if(Vector2.Distance(builder.Position,order.Position)>2.5f){Steer(builder,order.Position-builder.Position,4);continue;}
                order.Progress+=Step;
                float duration=order.Kind==VillageBuildOrder.Repair?3:order.Kind==VillageBuildOrder.Depot?6:8;
                if(order.Progress+0.001f<duration)continue;
                if(villages[(int)builder.Team].SpendConstruction(order.Kind)){
                    if(target!=null)target.State.Health=Mathf.Min(target.State.MaxHealth,target.State.Health+35);
                    else {var structure=Add(builder.Team,BattleTargetKind.Structure,new SkillActor(order.Kind==VillageBuildOrder.Depot?180:220),order.Position,ArenaLane.Mid);structure.IsDepot=order.Kind==VillageBuildOrder.Depot;structure.IsGuardPost=!structure.IsDepot;structure.AttackDamage=structure.IsDepot?0:14;}
                }
                builder.Construction=null;
            }
        }
        private void AdvanceWorkers(){
            foreach(var u in units){
                if(u.Villager?.Job.Effect!=VillageEffect.Gather||!u.State.Alive||Time>=OfflineMatchRules.MatchLimit)continue;
                if(u.WorkerOrder==VillageWorkerOrder.Hold)continue;
                if(u.WorkerOrder==VillageWorkerOrder.Return){
                    var depot=Depot(u);if(depot==null)continue;
                    if(Dist(u,depot)>2.5f){Steer(u,depot.Position-u.Position,4);continue;}
                    // Alternative depots store resources but never restore core respawns or wave production.
                    if(villages[(int)u.Team].DepositCargo(u.CargoWood,u.CargoStone,u.CargoCrystal)){
                        u.CargoWood=u.CargoStone=u.CargoCrystal=0;u.WorkerOrder=VillageWorkerOrder.Gather;
                    }
                    continue;
                }
                var node=WorkerNode(u);if(node==null){u.WorkerOrder=u.Cargo>0?VillageWorkerOrder.Return:VillageWorkerOrder.Hold;continue;}
                if(Vector2.Distance(u.Position,node.Position)>2.5f)Steer(u,node.Position-u.Position,4);
            }
        }
        private readonly List<Fallen> fallen=new List<Fallen>();
        private sealed class Fallen {public ArenaTeam Team;public ArenaLane Lane;public MinionRole Role;public Vector2 Position;public float Power,Health,Time;}
        public VillageSystem GetVillage(ArenaTeam team)=>villages[(int)team];
        private Vector2 Base(ArenaTeam team)=>new Vector2(team==ArenaTeam.Lux?14:Width-14,Height*.5f);
        private int nextId,tick; private double accumulator;
        private int nextDropId;private readonly System.Random dropRandom,combatRandom,relicRandom;
        private readonly List<ArenaFieldDrop> drops=new List<ArenaFieldDrop>();
        public IReadOnlyList<ArenaFieldDrop> Drops {get;}
        private readonly List<ArenaRelicDrop> relicDrops=new List<ArenaRelicDrop>();
        public IReadOnlyList<ArenaRelicDrop> RelicDrops {get;}
        public int RemainingUnits(ArenaTeam team)=>units.Count(u=>u.Team==team&&u.State.Alive);
        private bool CoreAlive(ArenaTeam team)=>units.Any(u=>u.Team==team&&u.Core&&u.State.Alive);
        private bool CanRespawn(ArenaTeam team)=>Time<OfflineMatchRules.MatchLimit&&CoreAlive(team);
        private void CheckElimination(){
            if(Finished)return;int lux=RemainingUnits(ArenaTeam.Lux),ten=RemainingUnits(ArenaTeam.Tenebra);
            if(lux==0||ten==0){Winner=lux==ten?(ArenaTeam?)null:lux==0?ArenaTeam.Tenebra:ArenaTeam.Lux;Finished=true;waves.EndMatch(Winner);drops.Clear();relicDrops.Clear();}
        }
        private readonly IBattleNavigation navigation;
        public IReadOnlyList<BattleUnit> Units {get;}
        public BattleUnit Player {get;}
        public float Time=>tick*Step;
        public bool Finished {get;private set;}
        public ArenaTeam? Winner {get;private set;}
        public OfflineBattle(string hero,IBattleNavigation navigation=null,int seed=1){
            this.navigation=navigation;dropRandom=new System.Random(seed);combatRandom=new System.Random(unchecked(seed*397+17));relicRandom=new System.Random(unchecked(seed*7919+71));Drops=drops.AsReadOnly();RelicDrops=relicDrops.AsReadOnly();
            HeroKitCatalog.Get(hero);
            Units=units.AsReadOnly();
            foreach(var c in OriginalCover)cover.Add((new Vector2(c.x*Width,c.y*Height),c.z*Height,float.PositiveInfinity));
            var roster=ArenaDraftRules.PracticeRoster(hero,seed);
            var lanes=new[]{ArenaLane.Top,ArenaLane.Mid,ArenaLane.Mid,ArenaLane.Bottom,ArenaLane.Bottom};
            foreach(ArenaTeam team in Enum.GetValues(typeof(ArenaTeam))){
                bool lux=team==ArenaTeam.Lux;
                for(int i=0;i<5;i++){
                    string id=roster[(lux?0:5)+i];
                    var u=Add(team,BattleTargetKind.Hero,new SkillActor(id),new Vector2(lux?17:Width-17,Height*.5f+(i-2)*5),lanes[i]);
                    if(lux&&i==0)Player=u;
                    else if(i==2){u.Jungler=true;u.Tactic=ArenaTactic.WildernessMastery;}
                }
                foreach(ArenaLane lane in Enum.GetValues(typeof(ArenaLane)))Add(team,BattleTargetKind.Structure,new SkillActor(340),new Vector2(lux?35:Width-35,LaneY[(int)lane]),lane);
                Add(team,BattleTargetKind.Structure,new SkillActor(600),new Vector2(lux?14:Width-14,Height*.5f),ArenaLane.Mid,true);
                var village=new VillageSystem(team,waves,this);villages[(int)team]=village;
                resourceNodes.Add(new VillageResourceNode(team,Base(team)+new Vector2(lux?12:-12,12)));
                resourceNodes.Add(new VillageResourceNode(team,Base(team)+new Vector2(lux?22:-22,-13)));
                for(int i=0;i<village.Members.Count;i++){
                    var member=village.Members[i];var pos=Base(team)+new Vector2((i-2.5f)*(lux?1:-1),1.5f);
                    var u=Add(team,BattleTargetKind.Villager,new SkillActor(200),pos,ArenaLane.Mid);u.Villager=member;
                }
            }
        }
        private BattleUnit Add(ArenaTeam team,BattleTargetKind kind,SkillActor state,Vector2 p,ArenaLane lane,bool core=false,bool temporary=false,MinionRole role=MinionRole.Infantry){
            state.Clock=Time;var u=new BattleUnit(++nextId,team,kind,state,p,lane,core,temporary,role);units.Add(u);byState.Add(state,u);return u;
        }
        private BattleUnit Find(SkillActor a)=>a!=null&&byState.TryGetValue(a,out var u)?u:null;
        private bool CoreOpen(ArenaTeam team)=>OfflineMatchRules.CoreOpen(units.Where(u=>u.Team==team&&u.Kind==BattleTargetKind.Structure&&!u.Core&&!u.Temporary&&!u.IsDepot&&!u.IsGuardPost).Select(u=>u.State.Alive));
        private bool Attackable(BattleUnit u)=>u.State.Alive&&u.State.Buff("untargetable",Time)<=0&&(!u.Core||CoreOpen(u.Team));
        private static bool Finite(Vector2 v)=>!float.IsNaN(v.x)&&!float.IsInfinity(v.x)&&!float.IsNaN(v.y)&&!float.IsInfinity(v.y);
        private bool Blocked(Vector2 p,float radius=1){
            if(!Finite(p)||p.x<2||p.y<2||p.x>Width-2||p.y>Height-2)return true;
            foreach(var c in cover)if(c.expires>Time&&Vector2.Distance(c.position,p)<c.radius+radius)return true;
            return false;
        }
        private bool Move(BattleUnit u,Vector2 direction,float distance){
            if(Finished||u==null||!u.State.CanMove(Time)||!Finite(direction)||direction.sqrMagnitude<.0025f||distance<=0)return false;
            u.RecallEnds=0;Vector2 p=u.Position,d=direction.normalized;int slices=Mathf.Max(1,Mathf.CeilToInt(distance/.35f));
            for(int i=0;i<slices;i++){var at=p+d*(distance/slices);if(Blocked(at)||(navigation!=null&&!navigation.CanTraverse(p,at)))break;p=at;}
            if(p==u.Position)return false;u.Position=p;return true;
        }
        private static float Dist(BattleUnit a,BattleUnit b)=>Vector2.Distance(a.Position,b.Position);
        private bool ClearSight(Vector2 from,Vector2 to){
            Vector2 d=to-from;float length=d.sqrMagnitude;if(length<.001f)return true;
            foreach(var c in cover){if(c.expires<=Time)continue;float at=Mathf.Clamp01(Vector2.Dot(c.position-from,d)/length);if((from+d*at-c.position).sqrMagnitude<c.radius*c.radius)return false;}
            return true;
        }
        private static int ConcealmentZone(Vector2 p){for(int i=0;i<Concealment.Length;i++){var c=Concealment[i];if(Vector2.Distance(p,new Vector2(c.x*Width,c.y*Height))<=c.z*Height)return i;}return -1;}
        public bool IsVisibleTo(ArenaTeam viewer,BattleUnit target){
            if(!ArenaDraftRules.ValidTeam(viewer)||target==null||Find(target.State)!=target||!target.State.Alive)return false;
            if(target.Team==viewer||Time>=OfflineMatchRules.MatchLimit||!CoreAlive(target.Team))return true;
            int zone=ConcealmentZone(target.Position);bool revealed=target.State.Buff("revealed",Time)>0;
            foreach(var observer in units){if(observer.Team!=viewer||!observer.State.Alive)continue;
                float radius=(observer.Kind==BattleTargetKind.Hero?20:observer.Kind==BattleTargetKind.Structure?12:9)+observer.State.Buff("vision",Time);
                float distance=Dist(observer,target);if(distance>radius)continue;
                if(zone>=0&&!revealed&&distance>2.5f&&ConcealmentZone(observer.Position)!=zone)continue;
                if(ClearSight(observer.Position,target.Position))return true;
            }return false;
        }
        public IReadOnlyList<SkillActor> Enemies(SkillActor actor,float radius,Vector2 aim){
            var a=Find(actor);if(a==null)return Array.Empty<SkillActor>();
            var list=units.Where(u=>u.Team!=a.Team&&Attackable(u)&&Dist(a,u)<=radius&&IsVisibleTo(a.Team,u)&&ClearSight(a.Position,u.Position)&&OfflineMatchRules.InAimCone(u.Position-a.Position,aim));
            return (aim.sqrMagnitude<.01f?list.OrderBy(u=>Dist(a,u)):list.OrderByDescending(u=>OfflineMatchRules.AimScore(u.Position-a.Position,aim))).ThenBy(u=>u.Id).Select(u=>u.State).ToArray();
        }
        public IReadOnlyList<SkillActor> Allies(SkillActor actor,float radius){
            var a=Find(actor);if(a==null)return Array.Empty<SkillActor>();
            return units.Where(u=>u.Team==a.Team&&u.Kind==BattleTargetKind.Hero&&u.State.Alive&&Dist(a,u)<=radius).OrderBy(u=>u.Id).Select(u=>u.State).ToArray();
        }
        public bool Hit(SkillActor actor,SkillActor target,float damage)=>ResolveHit(actor,target,damage,false);
        private bool ResolveHit(SkillActor actor,SkillActor target,float damage,bool basic){
            var a=Find(actor);var t=Find(target);
            if(Finished||a==null||t==null||!actor.Alive||a.Team==t.Team||!Attackable(t)||float.IsNaN(damage)||float.IsInfinity(damage)||damage<=0)return false;
            if(target.Buff("invulnerable",Time)>0)return false;
            if(basic&&actor.Buff("blind",Time)>0)return false;
            a.RecallEnds=0;t.RecallEnds=0;if(a.Kind==BattleTargetKind.Hero)actor.Set("revealed",1,Time+2,Time);
            float n=OfflineMatchRules.Damage(Mathf.Clamp(damage+a.RelicStats.Attack,0,300),a.Gear.Contains("blade"),t.Gear.Contains("armor")&&!a.Gear.Contains("sealbreaker"));
            if(t.Gear.Contains("armor")&&a.Gear.Contains("sealbreaker"))n*=.94f;
            if(basic&&a.Gear.Contains("precision")&&combatRandom.NextDouble()<.2)n*=1.5f;
            if(basic&&a.Gear.Contains("giantbane")&&t.Kind==BattleTargetKind.Hero)n+=Mathf.Min(20,t.State.MaxHealth*.035f);
            if(t.Gear.Contains("aegis")&&n>=50)n*=.8f;
            n*=1-Mathf.Clamp(t.RelicStats.Block+t.RelicStats.Mitigation,0,.42f);
            n*=1-Mathf.Clamp(actor.Buff("weaken",Time),0,.3f);n*=1+Mathf.Clamp(actor.Buff("fury",Time),0,.3f);
            n*=1-Mathf.Clamp(target.Buff("guard",Time),0,.4f);n*=1+Mathf.Clamp(target.Buff("vulnerable",Time),0,.2f);
            if(target.Kit?.Id=="phan")n*=1-.04f*t.ResolveStacks;
            if(actor.Kit?.Id=="jawo"&&Time-a.RhythmAt<=4)n*=1+.03f*a.RhythmStacks;
            if(t.Kind==BattleTargetKind.Minion)n*=1-Mathf.Clamp01(MinionCombatRules.Stats(t.Role).Defense-target.Buff("armor_break",Time));
            float actual=target.Absorb(n,Time);float priorHp=target.Health;
            if(n>0&&a.Kind==BattleTargetKind.Hero&&t.Kind==BattleTargetKind.Hero){
                t.RecentHeroDamage[a.Id]=Time;
                foreach(var tower in ActiveTowers(t.Team))if(Dist(tower,t)<=10&&Dist(tower,a)<=10){tower.AggressorId=a.Id;tower.AggroUntil=Time+3;}
            }
            if(t.Villager!=null){t.Villager.Damage(actual);target.Health=t.Villager.Health;
                if(!target.Alive){t.CargoWood=t.CargoStone=t.CargoCrystal=0;t.WorkerOrder=VillageWorkerOrder.Gather;t.Construction=null;}
            }
            else target.Health=Mathf.Max(0,target.Health-actual);
            float hpDamage=Mathf.Max(0,priorHp-target.Health);a.DamageDealt+=hpDamage;t.DamageTaken+=hpDamage;
            if(hpDamage>0&&a.Gear.Contains("withering_thorn")&&t.Kind==BattleTargetKind.Hero)target.Set("antiheal",.35f,Time+4,Time);
            if(basic&&a.Gear.Contains("renewal")&&t.Kind!=BattleTargetKind.Structure&&t.Kind!=BattleTargetKind.Villager)actor.Heal(hpDamage*.15f);
            if(actor.Kit?.Id=="mitch")target.Set("vulnerable",.1f,Time+3,Time);
            if(actor.Kit?.Id=="quin"&&Time>=a.TrailReady&&n>0){target.Set("revealed",1,Time+6,Time);a.TrailReady=Time+8;}
            if(actor.Kit?.Id=="jawo"&&n>0&&Time-a.RhythmAt>=.39f){a.RhythmStacks=Time-a.RhythmAt>4?1:Math.Min(5,a.RhythmStacks+1);a.RhythmAt=Time;}
            if(target.Kit?.Id=="trudice"&&hpDamage>0)actor.Health=Mathf.Max(1,actor.Health-hpDamage*Mathf.Clamp(target.Buff("reflect",Time),0,.3f));
            if(!target.Alive){
                if(a.Kind==BattleTargetKind.Hero&&t.Kind!=BattleTargetKind.Villager){a.Gold=Mathf.Min(9999,a.Gold+(t.Kind==BattleTargetKind.Hero?OfflineMatchRules.KillGold(t.ConsecutiveDeaths,t.KillStreak):t.Kind==BattleTargetKind.Structure?45:22));GainXp(a,t.Kind==BattleTargetKind.Hero?90:t.Kind==BattleTargetKind.Structure?65:16);}
                if(t.Kind==BattleTargetKind.Hero){
                    t.Deaths++;t.ConsecutiveDeaths++;t.KillStreak=0;t.RespawnAt=Time+OfflineMatchRules.RespawnDelay(Time);
                    if(a.Kind==BattleTargetKind.Hero){a.Kills++;a.KillStreak++;a.ConsecutiveDeaths=0;}
                    foreach(var contribution in t.RecentHeroDamage){
                        if(contribution.Key==a.Id||Time-contribution.Value>OfflineMatchRules.AssistWindow)continue;
                        var helper=units.FirstOrDefault(v=>v.Id==contribution.Key&&v.Team==a.Team&&v.Kind==BattleTargetKind.Hero);
                        if(helper!=null){helper.Assists++;helper.Gold=Mathf.Min(9999,helper.Gold+OfflineMatchRules.AssistGold);}
                    }
                    t.RecentHeroDamage.Clear();
                }
                if(t.Kind==BattleTargetKind.Minion){
                    if(fallen.Count>=240)fallen.RemoveAt(0);
                    fallen.Add(new Fallen{Team=t.Team,Lane=t.Lane,Role=t.Role,Position=t.Position,Power=t.Power,Health=t.State.MaxHealth,Time=Time});
                }
                if(t.Kind==BattleTargetKind.Minion||t.Kind==BattleTargetKind.Structure&&!t.Temporary)
                    villages[(int)a.Team]?.EnemyDefeated(t.Kind==BattleTargetKind.Structure);
                if(t.Core)waves.CoreDestroyed(t.Team);
                else if(t.Kind==BattleTargetKind.Structure&&!t.Temporary&&!t.IsDepot&&!t.IsGuardPost)waves.TowerDestroyed(t.Team);
                if(a.Kind==BattleTargetKind.Hero&&!t.Temporary&&t.Kind!=BattleTargetKind.Villager)RollDrop(a,t);
                CheckElimination();
            }
            return true;
        }
        private void RollDrop(BattleUnit killer,BattleUnit target){
            string source=target.Kind==BattleTargetKind.Hero?"hero":target.Kind==BattleTargetKind.Structure?"tower":"unit";
            double chance=source=="hero"?.43:source=="tower"?.65:.17;
            if(source=="hero"){
                killer.HeroKillHistory.TryGetValue(target.Id,out int repeat);killer.HeroKillHistory[target.Id]=repeat+1;
                if(repeat<2)RollRelic(killer,target.Position,.45f,"hero");
            }
            if(dropRandom.NextDouble()<chance)SpawnDrop(killer,target.Position,false);
        }
        private void SpawnDrop(BattleUnit killer,Vector2 position,bool boss){
            var item=ArenaPickupCatalog.Roll(killer.State.Kit.Id,killer.State.Level,dropRandom.NextDouble,boss);
            if(drops.Count>=ArenaPickupCatalog.Limit||drops.Count+relicDrops.Count>=36)return;
            drops.Add(new ArenaFieldDrop(++nextDropId,item,position,killer.Team,Time));
        }
        private WildernessCamp FindCamp(BattleUnit hero,Vector2 aim,float range)=>wilderness.Camps.Where(c=>c.Alive&&Vector2.Distance(hero.Position,c.Position)<=range&&ClearSight(hero.Position,c.Position)&&OfflineMatchRules.InAimCone(c.Position-hero.Position,aim)).OrderBy(c=>Vector2.Distance(hero.Position,c.Position)).ThenBy(c=>c.Id).FirstOrDefault();
        private bool HitCamp(BattleUnit hero,WildernessCamp camp,float range,float damage){
            if(Finished||hero==null||!hero.State.Alive||hero.State.Kit==null||camp==null||!ClearSight(hero.Position,camp.Position)||!wilderness.TryHit(camp.Id,hero.Id,hero.Position,range,damage,out bool defeated))return false;
            hero.RecallEnds=0;hero.State.Set("revealed",1,Time+2,Time);
            if(defeated){
                var a=hero.State;hero.Gold=Mathf.Min(9999,hero.Gold+(camp.Boss?90:30));GainXp(hero,camp.Boss?90:35);
                switch(camp.Kind){
                    case WildernessKind.AzureStag:a.Mana=Mathf.Min(a.MaxMana,a.Mana+25);a.Set("cooldown",.15f,Time+45,Time);break;
                    case WildernessKind.CrimsonWolf:a.Set("fury",.12f,Time+45,Time);break;
                    case WildernessKind.EmeraldSerpent:a.Set("regen",1.5f,Time+40,Time);break;
                    case WildernessKind.GoldenScarab:hero.Gold=Mathf.Min(9999,hero.Gold+60);break;
                    case WildernessKind.StoneGolem:a.Set("guard",.12f,Time+40,Time);break;
                    case WildernessKind.RiverSpirit:a.Set("vision",8,Time+40,Time);break;
                    case WildernessKind.WindFalcon:a.Set("haste",.12f,Time+40,Time);break;
                    case WildernessKind.AncientSentinel:case WildernessKind.ColossalGuardian:
                        foreach(var ally in units.Where(u=>u.Team==hero.Team&&u.Kind==BattleTargetKind.Hero&&u.State.Alive)){ally.Gold=Mathf.Min(9999,ally.Gold+35);GainXp(ally,45);if(camp.Kind==WildernessKind.AncientSentinel)ally.State.AddTemporaryShield(20,Time+12,Time);}
                        if(camp.Kind==WildernessKind.ColossalGuardian)waves.EmpowerSiege(hero.Team,2);break;
                }
                RollRelic(hero,camp.Position,camp.Boss?.65f:.4f,camp.Boss?"boss":"buff");
                if(dropRandom.NextDouble()<(camp.Boss?.92:.48))SpawnDrop(hero,camp.Position,camp.Boss);
            }return true;
        }
        private void AdvanceWilderness(){
            wilderness.Advance(Time);
            foreach(var camp in wilderness.Camps){if(!camp.Alive||camp.LastAttackerId==0)continue;
                var u=units.FirstOrDefault(x=>x.Id==camp.LastAttackerId&&x.Kind==BattleTargetKind.Hero&&x.State.Alive);
                if(u==null||!ClearSight(camp.Position,u.Position)||!wilderness.TryRetaliate(camp.Id,u.Id,u.Position,out float damage)||u.State.Buff("invulnerable",Time)>0)continue;
                var a=u.State;u.RecallEnds=0;float prior=a.Health;
                float n=OfflineMatchRules.Damage(damage,false,u.Gear.Contains("armor"))*(1-Mathf.Clamp(a.Buff("guard",Time),0,.4f));
                a.Health=Mathf.Max(0,a.Health-a.Absorb(n,Time));u.DamageTaken+=prior-a.Health;
                if(!a.Alive){u.Deaths++;u.KillStreak=0;u.RespawnAt=Time+OfflineMatchRules.RespawnDelay(Time);u.RecentHeroDamage.Clear();CheckElimination();}
                if(Finished)return;
            }
        }
        public bool AttackNeutralPlayer(int campId)=>campId>0&&Basic(Player,Vector2.zero,null,campId);
        private void RollRelic(BattleUnit hero,Vector2 position,float quality,string source){
            if(relicDrops.Count>=ArenaRelicCatalog.GroundLimit||drops.Count+relicDrops.Count>=36)return;
            var own=villages[(int)hero.Team];var foe=villages[1-(int)hero.Team];bool behind=own.Wood+own.Gold+own.Stone+80<foe.Wood+foe.Gold+foe.Stone;
            bool hunt=!CoreAlive(ArenaTeam.Lux)||!CoreAlive(ArenaTeam.Tenebra)||Time>=OfflineMatchRules.MatchLimit;
            var item=ArenaRelicCatalog.Roll(hero.State.Kit.Id,hero.State.Level,quality,source,hunt,behind,relicRandom.NextDouble);
            if(item!=null)relicDrops.Add(new ArenaRelicDrop(++nextDropId,item,position,Time));
        }
        public bool CollectPlayerRelic(int id)=>CollectRelic(Player,id);
        private bool CollectRelic(BattleUnit u,int id){
            if(Finished||!u.State.Alive||u.State.Kit==null)return false;
            var d=relicDrops.Find(x=>x.Id==id);if(d==null||Time-d.SpawnedAt>=ArenaRelicCatalog.Lifetime||d.Item.Hero!=u.State.Kit.Id||Vector2.Distance(u.Position,d.Position)>ArenaRelicCatalog.Radius)return false;
            var a=u.State;var item=d.Item;
            if(item.Consumable){float before=item.Slot=="health"?a.Health:a.Mana;if(item.Slot=="health")a.Heal(item.Amount);else a.Mana=Mathf.Min(a.MaxMana,a.Mana+item.Amount);if((item.Slot=="health"?a.Health:a.Mana)<=before)return false;}
            else{
                if(u.RelicSlots.TryGetValue(item.Slot,out var previous)&&previous.Tier>=item.Tier)return false;
                var old=u.RelicStats;u.RelicSlots[item.Slot]=item;var current=new ArenaRelicStats();foreach(var entry in u.RelicSlots.Values)current.Add(entry.Stats);u.RelicStats=current;
                a.MaxHealth+=current.Hp-old.Hp;a.Health=Mathf.Min(a.MaxHealth,a.Health+current.Hp-old.Hp);
                a.MaxMana+=current.Mana-old.Mana;a.Mana=Mathf.Min(a.MaxMana,a.Mana+current.Mana-old.Mana);
                a.ShieldCapacity=105+current.ShieldMax;a.PickupShield(Mathf.Max(0,current.ShieldMax-old.ShieldMax),Time);
                a.EquipmentCooldown=(u.Gear.Contains("wisdom")?.12f:0)+current.Cooldown;
            }
            relicDrops.Remove(d);return true;
        }
        public bool CollectPlayerPickup(int id)=>CollectPickup(Player,id);
        private bool CollectPickup(BattleUnit u,int id){
            if(Finished||!u.State.Alive||u.State.Kit==null)return false;
            var d=drops.Find(x=>x.Id==id);var s=u.State;
            if(!ArenaPickupCatalog.Eligible(d,s.Kit.Id,s.Level,u.Team,u.Position,Time))return false;
            var item=d.Item;float v=item.Value,amount=0;
            switch(item.Effect){
                case "health":float hp=s.Health;s.Heal(v);amount=s.Health-hp;break;
                case "mana":amount=Mathf.Max(0,Mathf.Min(v,s.MaxMana-s.Mana));s.Mana+=amount;break;
                case "shield":amount=s.PickupShield(v,Time);break;
                case "xp":if(s.Level<15){amount=Mathf.Round(v);GainXp(u,amount);}break;
                case "wood":case "gold":case "stone":amount=(float)villages[(int)u.Team].CreditPickup(item.Effect,Mathf.Round(v));break;
                case "cooldown":amount=s.ReduceActiveCooldowns(v/1000,Time);break;
                case "haste":case "fury":case "guard":case "regen":if(s.ExtendPickupBuff(item.Effect,v,item.Duration,Time))amount=v;break;
            }
            if(amount<=0)return false;drops.Remove(d);return true;
        }
        private void CollectNearby(BattleUnit u){for(int i=drops.Count-1;i>=0;i--)if(CollectPickup(u,drops[i].Id))break;for(int i=relicDrops.Count-1;i>=0;i--)if(CollectRelic(u,relicDrops[i].Id))break;}
        public bool Dash(SkillActor actor,Vector2 direction,float distance)=>Move(Find(actor),direction,distance);
        public bool Wall(SkillActor actor,Vector2 dir,float distance,float radius,float duration){
            var a=Find(actor);if(Finished||a==null||!actor.Alive||cover.Count>=20||!Finite(dir))return false;
            Vector2 p=a.Position+dir.normalized*distance;if(Blocked(p,radius))return false;
            cover.Add((p,radius,Time+duration));return true;
        }
        public bool Turret(SkillActor actor,Vector2 dir,float distance,float health,float duration,float damage){
            var a=Find(actor);if(Finished||a==null||!actor.Alive||!Finite(dir)||units.Count(u=>u.Team==a.Team&&u.Temporary&&u.State.Alive)>=3)return false;
            Vector2 p=a.Position+dir.normalized*distance;if(Blocked(p,1.6f))return false;
            var t=Add(a.Team,BattleTargetKind.Structure,new SkillActor(health),p,a.Lane,temporary:true);t.Expires=Time+duration;t.AttackDamage=damage;return true;
        }
        public bool CastPlayer(SkillSlot slot,Vector2 aim){bool ok=Player.State.TryCast(this,slot,aim,Time,!Finished);if(ok)Player.RecallEnds=0;return ok;}
        public bool PlayerAttack(Vector2 aim)=>Basic(Player,aim);
        public bool PlayerAttackTarget(BattleTargetKind kind,Vector2 aim)=>Basic(Player,aim,kind);
        public bool RecallPlayer()=>BeginRecall(Player);
        private bool BeginRecall(BattleUnit u){if(Finished||!u.State.CanMove(Time)||!u.State.CanCast(Time)||!CanRespawn(u.Team)||u.IsRecalling||Vector2.Distance(u.Position,u.Spawn)<10)return false;u.RecallEnds=Time+4;return true;}
        public bool SelectPlayerTactic(ArenaTactic tactic){if(Finished||Time!=0||Player.TacticReadyAt>0||ArenaTacticalRules.Cooldown(tactic)<0)return false;Player.Tactic=tactic;return true;}
        public bool UsePlayerTactic(Vector2 aim)=>UseTactic(Player,aim);
        private bool UseTactic(BattleUnit u,Vector2 aim){
            var a=u.State;var tactic=u.Tactic;float cooldown=ArenaTacticalRules.Cooldown(tactic);
            if(Finished||!a.Alive||!Finite(aim)||cooldown<0||Time<u.TacticReadyAt||a.Buff("suppression",Time)>0||tactic!=ArenaTactic.CleansingLight&&!a.CanCast(Time))return false;
            bool ok=false;float before=a.Health;var enemies=Enemies(a,6,aim).Where(e=>e.Kit!=null).ToArray();
            switch(tactic){
                case ArenaTactic.Renew:a.Heal(35);ok=a.Health>before;break;
                case ArenaTactic.SwiftPassage:ok=Dash(a,aim,5);break;
                case ArenaTactic.DivineRefuge:ok=a.AddTemporaryShield(40,Time+5,Time)>0;break;
                case ArenaTactic.CleansingLight:a.Cleanse(Time);a.Set("ccimmune",1,Time+1.5f,Time);ok=true;break;
                case ArenaTactic.FinalStrike:var target=enemies.FirstOrDefault(e=>e.Health/e.MaxHealth<=.25f);ok=target!=null&&Hit(a,target,35);break;
                case ArenaTactic.SharedGrace:foreach(var ally in Allies(a,8)){float hp=ally.Health;ally.Heal(20);ok|=ally.Health>hp;}break;
                case ArenaTactic.Pursuit:a.Set("haste",.22f,Time+4,Time);ok=true;break;
                case ArenaTactic.BindingSeal:var foe=enemies.FirstOrDefault();if(foe!=null&&foe.Buff("ccimmune",Time)<=0){foe.Set("root",1,Time+1,Time);ok=true;}break;
                case ArenaTactic.GuardiansStand:a.Set("guard",.25f,Time+4,Time);ok=true;break;
                case ArenaTactic.BattleFervor:a.Set("attack_speed",.25f,Time+5,Time);ok=true;break;
                case ArenaTactic.Rally:foreach(var ally in Allies(a,8)){ally.Set("haste",.15f,Time+4,Time);ok=true;}break;
                case ArenaTactic.WildernessMastery:ok=HitCamp(u,FindCamp(u,aim,6),6,90);break;
            }
            if(ok){u.TacticReadyAt=Time+cooldown;u.RecallEnds=0;}return ok;
        }
        public bool BuyPlayer(string item)=>Buy(Player,item);
        public bool SellPlayer(string item)=>Sell(Player,item);
        private void GearChanged(BattleUnit u,string item,bool purchased){
            u.State.EquipmentCooldown=(u.Gear.Contains("wisdom")?.12f:0)+u.RelicStats.Cooldown;
            if(item=="vitality"){u.State.MaxHealth+=purchased?45:-45;u.State.Health=Mathf.Min(u.State.MaxHealth,u.State.Health);}
        }
        private bool Buy(BattleUnit u,string item){int gold=u.Gold;bool ok=OfflineMatchRules.TryBuy(item,u.Gear,ref gold,Vector2.Distance(u.Position,u.Spawn),u.State.Alive,!Finished&&CoreAlive(u.Team));u.Gold=gold;if(ok)GearChanged(u,item,true);return ok;}
        private bool Sell(BattleUnit u,string item){int gold=u.Gold;bool ok=OfflineMatchRules.TrySell(item,u.Gear,ref gold,Vector2.Distance(u.Position,u.Spawn),u.State.Alive,!Finished&&CoreAlive(u.Team));u.Gold=gold;if(ok)GearChanged(u,item,false);return ok;}
        private bool Basic(BattleUnit u,Vector2 aim,BattleTargetKind? kind=null,int campId=0){
            var a=u.State;var k=a.Kit;float speed=1+(u.Gear.Contains("fervor")?.2f:0)+Mathf.Clamp(a.Buff("attack_speed",Time),0,.25f);
            if(Finished||!a.CanAttack(Time)||k==null||!Finite(aim)||Time-u.LastAttack<k.BasicCooldown/speed)return false;
            if(campId!=0){if(campId<0||!HitCamp(u,wilderness.Find(campId),k.BasicRange,k.BasicDamage+u.RelicStats.Attack+(u.Gear.Contains("blade")?7:0)))return false;u.LastAttack=Time;return true;}
            var target=Enemies(a,k.BasicRange,aim).FirstOrDefault(e=>!kind.HasValue||Find(e).Kind==kind.Value);
            if(target==null){if(kind.HasValue||!HitCamp(u,FindCamp(u,aim,k.BasicRange),k.BasicRange,k.BasicDamage+u.RelicStats.Attack+(u.Gear.Contains("blade")?7:0)))return false;}
            else if(!ResolveHit(a,target,k.BasicDamage,true))return false;u.LastAttack=Time;return true;
        }
        private static void GainXp(BattleUnit u,float n){
            var a=u.State;if(a.Kit==null||!a.Alive)return;u.Xp+=n;
            while(a.Level<15){float threshold=65*a.Level+18*a.Level*a.Level;if(u.Xp<threshold)break;u.Xp-=threshold;a.Level++;a.MaxHealth+=8;a.Heal(22);a.Mana=Mathf.Min(a.MaxMana,a.Mana+12);}
        }
        private bool Spawn(MinionSpawn m){
            if(units.Count(u=>u.Kind==BattleTargetKind.Minion&&u.State.Alive)>=240)return false;
            var stats=MinionCombatRules.Stats(m.Role);
            var u=Add(m.Team,BattleTargetKind.Minion,new SkillActor(stats.Health*m.Power),new Vector2(m.Team==ArenaTeam.Lux?19:Width-19,LaneY[(int)m.Lane]),m.Lane,role:m.Role);u.Power=m.Power;return true;
        }
        private int Towers(ArenaTeam team)=>units.Count(u=>u.Team==team&&u.Kind==BattleTargetKind.Structure&&!u.Core&&!u.Temporary&&!u.IsDepot&&!u.IsGuardPost&&u.State.Alive);
        public void Advance(float seconds,Vector2 playerMove){
            if(Finished||float.IsNaN(seconds)||float.IsInfinity(seconds)||seconds<0)return;
            accumulator+=Math.Min(seconds,.5f);
            while(accumulator+1e-7>=Step&&!Finished){accumulator-=Step;Tick(Vector2.ClampMagnitude(Finite(playerMove)?playerMove:Vector2.zero,1));}
        }
        private void Tick(Vector2 move){
            tick++;cover.RemoveAll(c=>c.expires<=Time);fallen.RemoveAll(f=>Time-f.Time>25);
            drops.RemoveAll(d=>Time-d.SpawnedAt>=ArenaPickupCatalog.Lifetime);relicDrops.RemoveAll(d=>Time-d.SpawnedAt>=ArenaRelicCatalog.Lifetime);
            foreach(var m in waves.Advance(Step,Towers(ArenaTeam.Lux),Towers(ArenaTeam.Tenebra)))Spawn(m);
            foreach(var u in units)u.State.Clock=Time;
            AdvanceWilderness();if(Finished)return;
            AdvanceWorkers();AdvanceConstruction();
            foreach(var village in villages)village.Advance(Step);
            foreach(var u in units)if(u.Villager!=null){
                if(!u.State.Alive&&u.Villager.Alive){u.Position=u.Spawn;u.WorkerOrder=VillageWorkerOrder.Gather;}
                u.State.Health=u.Villager.Health;
            }
            if(tick%10==0)VillageAuras();
            HeroPassives();
            var copy=units.ToArray();
            foreach(var u in copy){
                if(Finished)break;var a=u.State;if(u.Villager!=null)continue;
                if(u.Temporary&&u.Expires<=Time)a.Health=0;
                if(!a.Alive){
                    if(u.Kind==BattleTargetKind.Hero&&CanRespawn(u.Team)&&Time>=u.RespawnAt){a.Respawn();u.Position=u.Spawn;u.Retreat=false;}
                    continue;
                }
                if(u.Kind==BattleTargetKind.Hero){
                    if(u.IsRecalling){
                        if(!CanRespawn(u.Team)||!a.CanMove(Time)||!a.CanCast(Time)||u==Player&&move.sqrMagnitude>=.0025f)u.RecallEnds=0;
                        else if(Time>=u.RecallEnds){u.Position=u.Spawn;u.RecallEnds=0;u.Retreat=false;}
                        else continue;
                    }
                    a.Heal(a.Buff("regen",Time)*Step);
                    a.Mana=Mathf.Min(a.MaxMana,a.Mana+((u.Gear.Contains("wisdom")?1.4f:0)+u.RelicStats.Regen)*Step);
                    if(tick%10==0){u.Gold=Mathf.Min(9999,u.Gold+2);GainXp(u,3);}
                    if(CanRespawn(u.Team)&&Vector2.Distance(u.Position,u.Spawn)<10){a.Heal(.8f);a.Mana=Mathf.Min(a.MaxMana,a.Mana+.8f);}
                    float speed=OfflineMatchRules.MoveSpeed(a.Kit.Speed,u.Gear.Contains("boots"))*(1+u.RelicStats.Speed)*(1+a.Buff("haste",Time))*(1-Mathf.Clamp(a.Buff("slow",Time),0,.45f));
                    if(a.Kit.Id=="jawo"&&Time-u.RhythmAt<=4)speed*=1+.02f*u.RhythmStacks;
                    if(units.Any(v=>v.Team==u.Team&&v.State.Alive&&v.State.Kit?.Id=="ellusur"&&Dist(u,v)<=8.75f))speed*=1.1f;
                    if(u==Player){Move(u,move,speed*move.magnitude*Step);CollectNearby(u);continue;}
                    Bot(u,speed);if(!Finished)CollectNearby(u);
                }else if(u.Kind==BattleTargetKind.Minion)Minion(u);
                else Structure(u);
            }
            for(int i=units.Count-1;i>=0;i--){var u=units[i];if(!u.State.Alive&&(u.Kind==BattleTargetKind.Minion||u.Temporary)){byState.Remove(u.State);units.RemoveAt(i);}}
            CheckElimination();
            // 15 minutes is reinforcement cutoff, not an arbitrary winner. If neither faction can move/attack, draw rather than award a false victory.
            if(!Finished&&Time>=OfflineMatchRules.MatchLimit&&!units.Any(u=>u.State.Alive&&(u.Temporary||u.Kind==BattleTargetKind.Hero||u.Kind==BattleTargetKind.Minion&&u.Role!=MinionRole.Healer))&&!units.Any(u=>u.Kind==BattleTargetKind.Structure&&!u.IsDepot&&u.State.Alive&&units.Any(v=>v.Team!=u.Team&&Attackable(v)&&Dist(u,v)<=10&&ClearSight(u.Position,v.Position)))){Finished=true;Winner=null;waves.EndMatch(null);drops.Clear();relicDrops.Clear();}
        }
        // Classic conquest: surviving towers before core health ratio; an exact tie stays a draw.
        public static ArenaTeam? ResolveTimeout(int luxTowers,int tenebraTowers,float luxCoreRatio,float tenebraCoreRatio){
            if(luxTowers!=tenebraTowers)return luxTowers>tenebraTowers?ArenaTeam.Lux:ArenaTeam.Tenebra;
            string w=OfflineMatchRules.TimeLimitWinner(luxCoreRatio,tenebraCoreRatio);
            return w=="A"?ArenaTeam.Lux:w=="B"?ArenaTeam.Tenebra:(ArenaTeam?)null;
        }
        private Vector2 LaneGoal(BattleUnit u){
            float y=LaneY[(int)u.Lane];if(Mathf.Abs(u.Position.y-y)>4&&Mathf.Abs(u.Position.x-u.Spawn.x)<24)return new Vector2(u.Position.x,y);
            return new Vector2(u.Team==ArenaTeam.Lux?Width-14:14,y);
        }
        private void Steer(BattleUnit u,Vector2 dir,float speed){
            if(dir.sqrMagnitude<1)return;float n=Mathf.Min(speed*Step,dir.magnitude);
            if(Move(u,dir,n))return;
            if(navigation!=null&&navigation.TryWaypoint(u.Position,u.Position+dir,out var waypoint)&&Move(u,waypoint-u.Position,n))return;
            if(!Move(u,new Vector2(-dir.y,dir.x),n))Move(u,new Vector2(dir.y,-dir.x),n);
        }
        private void Bot(BattleUnit u,float speed){
            var a=u.State;u.Retreat=CanRespawn(u.Team)&&OfflineMatchRules.Retreat(a.Health/a.MaxHealth,u.Retreat);
            if(Vector2.Distance(u.Position,u.Spawn)<12&&CoreAlive(u.Team)){
                var order=a.Health/a.MaxHealth<.45f?new[]{"armor","vitality","boots","blade","aegis","wisdom"}:new[]{"blade","boots","armor","withering_thorn","sealbreaker","renewal"};
                foreach(var item in order)Buy(u,item);
            }
            if(u.Retreat){if(a.Health/a.MaxHealth<.45f)UseTactic(u,Vector2.zero);if(!units.Any(v=>v.Team!=u.Team&&Attackable(v)&&Dist(u,v)<15)&&BeginRecall(u))return;Steer(u,u.Spawn-u.Position,speed);return;}
            var t=units.Where(v=>v.Team!=u.Team&&Attackable(v)&&Dist(u,v)<=18&&IsVisibleTo(u.Team,v)).OrderByDescending(v=>18-Dist(u,v)+(1-v.State.Health/v.State.MaxHealth)*7+(v.Core?9:v.Kind==BattleTargetKind.Hero?3.5f:v.Kind==BattleTargetKind.Structure?2:0)).ThenBy(v=>v.Id).FirstOrDefault();
            if(t==null&&u.Jungler&&CanRespawn(u.Team)&&CoreAlive((ArenaTeam)(1-(int)u.Team))&&a.Health/a.MaxHealth>.55f){
                var camp=wilderness.Camps.Where(c=>c.Alive&&(c.Boss?Vector2.Distance(u.Position,c.Position)<40:((u.Team==ArenaTeam.Lux)==(c.Position.x<Width/2)))&&(Time<180||Vector2.Distance(u.Position,c.Position)<35)).OrderBy(c=>Vector2.Distance(u.Position,c.Position)).ThenBy(c=>c.Id).FirstOrDefault();
                if(camp!=null){var dir=camp.Position-u.Position;if(dir.magnitude>a.Kit.BasicRange*.9f)Steer(u,dir,speed);else{if(camp.Health<=90)UseTactic(u,dir);Basic(u,dir,null,camp.Id);}return;}
            }
            if(t==null&&(!CoreAlive((ArenaTeam)(1-(int)u.Team))||Time>=OfflineMatchRules.MatchLimit))t=units.Where(v=>v.Team!=u.Team&&Attackable(v)).OrderBy(v=>Dist(u,v)).ThenBy(v=>v.Id).FirstOrDefault();
            var goal=t==null?LaneGoal(u):t.Position;
            if(CanRespawn(u.Team)&&CoreAlive((ArenaTeam)(1-(int)u.Team))&&t!=null&&t.Kind==BattleTargetKind.Structure&&t.State.Health>80&&!units.Any(v=>v.Team==u.Team&&v.Kind==BattleTargetKind.Minion&&v.State.Alive&&Dist(v,t)<12)&&Dist(u,t)<11){Steer(u,u.Position-t.Position,speed);return;}
            if(t==null||Dist(u,t)>Mathf.Max(1.5f,a.Kit.BasicRange*.82f))Steer(u,goal-u.Position,speed);
            if(t==null||tick%6!=0)return;
            var dir=t.Position-u.Position;Basic(u,dir);a.TryCast(this,SkillSlot.Primary,dir,Time,!Finished);
            if(Enemies(a,8,Vector2.zero).Count>=2)a.TryCast(this,SkillSlot.Secondary,dir,Time,!Finished);
            if(Enemies(a,8,Vector2.zero).Count>=3)a.TryCast(this,SkillSlot.Ultimate,dir,Time,!Finished);
        }
        private void Minion(BattleUnit u){
            var s=MinionCombatRules.Stats(u.Role);
            var candidates=units.Where(v=>v!=u&&(v.Kind!=BattleTargetKind.Villager||!CoreAlive(v.Team)||Time>=OfflineMatchRules.MatchLimit)&&v.State.Alive&&Dist(u,v)<=s.RangeSourceUnits/40&&(v.Team==u.Team||IsVisibleTo(u.Team,v)&&ClearSight(u.Position,v.Position))).Select(v=>new BattleTarget(v.Id,v.Team,v.Kind,Dist(u,v)*40,true,Attackable(v),v.State.MaxHealth-v.State.Health));
            var target=MinionCombatRules.Select(u.Role,u.Team,candidates,s.RangeSourceUnits);
            if(target.HasValue){
                if(Time-u.LastAttack<s.Cooldown)return;
                var t=units.First(v=>v.Id==target.Value.Id);
                if(u.Role==MinionRole.Healer)t.State.Heal(s.HealAmount*u.Power);
                else{
                    Hit(u.State,t.State,MinionCombatRules.HitDamage(u.Role,u.Power,t.Kind,0));
                    if(s.SplashRadiusSourceUnits>0)foreach(var v in units.ToArray())if(v!=t&&v.Kind!=BattleTargetKind.Villager&&v.Team!=u.Team&&Attackable(v)&&Dist(t,v)*40<=s.SplashRadiusSourceUnits)Hit(u.State,v.State,MinionCombatRules.HitDamage(u.Role,u.Power,v.Kind,0));
                }
                u.LastAttack=Time;return;
            }
            var goal=LaneGoal(u);
            if(!CoreAlive((ArenaTeam)(1-(int)u.Team))||Time>=OfflineMatchRules.MatchLimit){var enemy=units.Where(v=>v.Team!=u.Team&&Attackable(v)).OrderBy(v=>Dist(u,v)).ThenBy(v=>v.Id).FirstOrDefault();if(enemy!=null)goal=enemy.Position;}
            Steer(u,goal-u.Position,s.SpeedSourceUnits/40*(1+u.State.Buff("haste",Time))*(1-Mathf.Clamp(u.State.Buff("slow",Time),0,.45f)));
        }
        private IEnumerable<BattleUnit> ActiveTowers(ArenaTeam team)=>units.Where(u=>u.Team==team&&u.Kind==BattleTargetKind.Structure&&!u.Core&&!u.Temporary&&!u.IsDepot&&!u.IsGuardPost&&u.State.Alive);
        public int LowestTowerLevel(ArenaTeam team)=>ActiveTowers(team).Select(u=>u.TowerLevel).DefaultIfEmpty(0).Min();
        public bool UpgradeTower(ArenaTeam team,int expectedLevel,float hpFraction,float damageFraction){
            if(Finished||expectedLevel<1||hpFraction<0||damageFraction<0||float.IsNaN(hpFraction)||float.IsNaN(damageFraction)||float.IsInfinity(hpFraction)||float.IsInfinity(damageFraction))return false;
            var t=ActiveTowers(team).Where(u=>u.TowerLevel==expectedLevel).OrderBy(u=>u.Id).FirstOrDefault();
            if(t==null)return false;float gain=t.State.MaxHealth*hpFraction;t.State.MaxHealth+=gain;t.State.Health+=gain;t.TowerLevel++;t.TowerDamageMultiplier+=damageFraction;return true;
        }
        public bool Deploy(ArenaTeam team,ArenaLane lane,int count,float power){
            if(Finished||Time>=OfflineMatchRules.MatchLimit||count<1||count>2||power<=0||float.IsNaN(power)||float.IsInfinity(power)||units.Count(u=>u.Kind==BattleTargetKind.Minion&&u.State.Alive)+count>240)return false;
            for(int i=0;i<count;i++)if(!Spawn(new MinionSpawn(team,lane,MinionRole.Infantry,waves.Wave,Time,power)))return false;
            return true;
        }
        public bool HealNearBase(ArenaTeam team,float amount,float radiusSourceUnits){
            if(Finished)return false;
            foreach(var u in units)if(u.Team==team&&u.State.Alive&&(u.Kind==BattleTargetKind.Minion||u.Kind==BattleTargetKind.Structure)&&Vector2.Distance(u.Position,Base(team))*40<=radiusSourceUnits)u.State.Heal(amount);
            return true;
        }
        public bool GiveItem(ArenaTeam team,VillageItem item,float power){
            if(Finished)return false;bool given=false;
            foreach(var u in units)if(u.Team==team&&u.Kind==BattleTargetKind.Hero&&u.State.Alive){
                var s=u.State;
                switch(item){case VillageItem.Heal:s.Heal(s.MaxHealth*.10f*power);break;case VillageItem.Shield:s.AddTemporaryShield(s.MaxHealth*.08f*power,Time+8,Time);break;case VillageItem.Boost:s.Set("fury",.10f,Time+8,Time);break;default:return false;}
                given=true;
            }
            return given;
        }
        public bool CraftAtFront(ArenaTeam team,VillageItem item){
            if(Finished)return false;
            var front=units.Where(u=>u.Team==team&&u.Kind==BattleTargetKind.Minion&&u.State.Alive).OrderByDescending(u=>team==ArenaTeam.Lux?u.Position.x:Width-u.Position.x).ThenBy(u=>u.Id).FirstOrDefault();
            if(front==null)return false;
            var foes=units.Where(u=>u.Team!=team&&u.Kind==BattleTargetKind.Minion&&u.State.Alive&&Dist(u,front)*40<=180).ToArray();
            switch(item){
                case VillageItem.Bomb:foreach(var u in foes)Hit(front.State,u.State,80);break;
                case VillageItem.Poison:foreach(var u in foes){Hit(front.State,u.State,40);u.State.Set("slow",.2f,Time+4,Time);}break;
                case VillageItem.ArmorBreak:foreach(var u in foes)u.State.Set("armor_break",.2f,Time+6,Time);break;
                case VillageItem.Rage:foreach(var u in units)if(u.Team==team&&u.Kind==BattleTargetKind.Minion&&u.State.Alive&&Dist(u,front)*40<=250)u.State.Set("fury",.25f,Time+6,Time);break;
                default:return false;
            }
            return true;
        }
        public int ReviveRecent(ArenaTeam team,int maxCount,float seconds,float healthFraction){
            if(Finished||Time>=OfflineMatchRules.MatchLimit||maxCount<=0||seconds<=0||healthFraction<=0||healthFraction>1)return 0;
            int count=0;int capacity=240-units.Count(u=>u.Kind==BattleTargetKind.Minion&&u.State.Alive);
            for(int i=fallen.Count-1;i>=0&&count<maxCount&&count<capacity;i--){
                var f=fallen[i];if(f.Team!=team||Time-f.Time>seconds)continue;
                var state=new SkillActor(f.Health);state.Health=f.Health*healthFraction;
                var u=Add(team,BattleTargetKind.Minion,state,f.Position,f.Lane,role:f.Role);u.Power=f.Power;fallen.RemoveAt(i);count++;
            }
            return count;
        }
        private void HeroPassives(){
            var heroes=units.Where(u=>u.Kind==BattleTargetKind.Hero&&u.State.Alive).ToArray();
            foreach(var u in heroes){
                var a=u.State;var id=a.Kit.Id;
                if(id=="phan"){
                    bool near=units.Any(v=>v.Team==u.Team&&v.Kind==BattleTargetKind.Structure&&v.State.Alive&&Dist(u,v)<=6.25f);
                    if(Time>=u.ResolveAt){u.ResolveStacks=Mathf.Clamp(u.ResolveStacks+(near?1:-1),0,5);u.ResolveAt=Time+(near?1:3);}
                    a.Heal(.1f*u.ResolveStacks*Step);
                }else if(id=="van"){
                    var friends=heroes.Where(v=>v!=u&&v.Team==u.Team&&Dist(u,v)<=7.5f).ToArray();
                    if(friends.Length>0){a.Set("guard",.12f,Time+.2f,Time);a.Heal(.4f*Step);}
                    foreach(var friend in friends){friend.State.Set("guard",.12f,Time+.2f,Time);friend.State.Heal(.4f*Step);}
                }else if(id=="christian"){
                    foreach(var friend in heroes)if(friend!=u&&friend.Team==u.Team&&Dist(u,friend)<=8.75f)friend.State.Heal(friend.State.MaxHealth*.01f*Step);
                }else if(id=="lhen"){
                    if(Time>=u.HarmonyAt&&heroes.Any(v=>v!=u&&v.Team==u.Team&&Dist(u,v)<=8)){a.HarmonyStacks=Math.Min(5,a.HarmonyStacks+1);u.HarmonyAt=Time+2;}
                }else if(id=="ace"){
                    if(a.TriageSequence>u.TriageSeen){u.TriageSeen=a.TriageSequence;u.TriageOrigin=u.Position;u.TriageUntil=a.LastCastAt+10;u.TriageUsed=false;}
                    if(a.Buff("triage",Time)<=0||Time>=u.TriageUntil)continue;
                    foreach(var friend in units.Where(v=>v.Team==u.Team&&v.Kind==BattleTargetKind.Hero&&Vector2.Distance(v.Position,u.TriageOrigin)<=8.75f).OrderBy(v=>v.Id)){
                        if(friend.State.Alive)friend.State.Heal(4*Step);
                        else if(!u.TriageUsed&&CanRespawn(friend.Team)){friend.State.Respawn();friend.State.Health=friend.State.MaxHealth*.5f;friend.RespawnAt=0;friend.RecallEnds=0;friend.Retreat=false;u.TriageUsed=true;}
                    }
                }
            }
        }
        private void VillageAuras(){
            foreach(var u in units){
                if(u.Kind!=BattleTargetKind.Hero||!u.State.Alive||Vector2.Distance(u.Position,Base(u.Team))*40>700)continue;
                var v=villages[(int)u.Team];var healer=v.Find("serah");var reviver=v.Find("mora");var builder=v.Find("aron")??v.Find("rogar");
                if(healer?.Alive==true)u.State.Heal(2*healer.Power);
                if(reviver?.Alive==true)u.State.Set("fury",.05f*reviver.Power,Time+1.5f,Time);
                if(builder?.Alive==true)u.State.Set("guard",.05f*builder.Power,Time+1.5f,Time);
            }
        }
        private void Structure(BattleUnit u){
            if(u.IsDepot||Time-u.LastAttack<1)return;
            bool guardian=!u.Core&&!u.Temporary;
            var t=units.Where(v=>v.Team!=u.Team&&Attackable(v)&&Dist(u,v)<=10&&IsVisibleTo(u.Team,v)&&ClearSight(u.Position,v.Position))
                .OrderBy(v=>OfflineMatchRules.TowerPriority(v.Kind,guardian&&v.Id==u.AggressorId&&Time<u.AggroUntil))
                .ThenBy(v=>Dist(u,v)).ThenBy(v=>v.Id).FirstOrDefault();
            if(t==null){u.LastTowerTarget=0;u.ConsecutiveTowerHits=0;return;}
            int hits=guardian&&t.Kind==BattleTargetKind.Hero&&u.LastTowerTarget==t.Id?u.ConsecutiveTowerHits:0;
            float multiplier=guardian&&t.Kind==BattleTargetKind.Hero?OfflineMatchRules.TowerRamp(hits):1;
            if(Hit(u.State,t.State,u.AttackDamage*u.TowerDamageMultiplier*multiplier)){
                u.LastAttack=Time;u.LastTowerTarget=t.Id;u.ConsecutiveTowerHits=Math.Min(4,hits+1);
            }
        }
    }
}
