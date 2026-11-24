using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
namespace Buklod.Empire {
    public sealed class BattleUnit {
        public readonly int Id; public readonly ArenaTeam Team; public readonly BattleTargetKind Kind;
        public readonly SkillActor State; public readonly ArenaLane Lane;
        public readonly bool Core, Temporary; public readonly MinionRole Role;
        public readonly Vector2 Spawn; public Vector2 Position {get;internal set;}
        public float Power=1, AttackDamage=18, Expires=float.PositiveInfinity, RespawnAt, Xp;
        public int Gold=120, TowerLevel=1;
        public int Kills {get;internal set;} public int Deaths {get;internal set;} public int Assists {get;internal set;}
        internal int AggressorId, LastTowerTarget, ConsecutiveTowerHits;
        internal float AggroUntil;
        internal readonly Dictionary<int,float> RecentHeroDamage=new Dictionary<int,float>();
        public float TowerDamageMultiplier=1;
        public VillageMember Villager {get;internal set;}
        public bool Retreat; public float LastAttack=float.NegativeInfinity;
        public readonly HashSet<string> Gear=new HashSet<string>();
        internal BattleUnit(int id,ArenaTeam team,BattleTargetKind kind,SkillActor state,Vector2 pos,ArenaLane lane,bool core=false,bool temporary=false,MinionRole role=MinionRole.Infantry){
            Id=id;Team=team;Kind=kind;State=state;Spawn=Position=pos;Lane=lane;Core=core;Temporary=temporary;Role=role;
        }
    }
    // Match-local Unity C# simulation. Original Genesis Rift size and cover. Rendering,
    // NavMesh and village adapter are separate integration tasks; no persistent economy.
    public interface IBattleNavigation {
        bool CanTraverse(Vector2 from,Vector2 to);
        bool TryWaypoint(Vector2 from,Vector2 goal,out Vector2 waypoint);
    }
    public sealed class OfflineBattle : IHeroSkillWorld, IVillageBattle {
        public const float Width=320, Height=220, Step=.1f;
        private static readonly float[] LaneY={Height*.19f,Height*.5f,Height*.81f};
        private static readonly Vector3[] OriginalCover={
            new Vector3(.29f,.23f,.025f),new Vector3(.71f,.77f,.025f),new Vector3(.42f,.41f,.025f),
            new Vector3(.58f,.59f,.025f),new Vector3(.48f,.81f,.018f),new Vector3(.52f,.19f,.018f)};
        private readonly List<BattleUnit> units=new List<BattleUnit>();
        private readonly Dictionary<SkillActor,BattleUnit> byState=new Dictionary<SkillActor,BattleUnit>();
        private readonly List<(Vector2 position,float radius,float expires)> cover=new List<(Vector2,float,float)>();
        private readonly MinionWaveDirector waves=new MinionWaveDirector();
        private readonly VillageSystem[] villages=new VillageSystem[2];
        private readonly List<Fallen> fallen=new List<Fallen>();
        private sealed class Fallen {public ArenaTeam Team;public ArenaLane Lane;public MinionRole Role;public Vector2 Position;public float Power,Health,Time;}
        public VillageSystem GetVillage(ArenaTeam team)=>villages[(int)team];
        private Vector2 Base(ArenaTeam team)=>new Vector2(team==ArenaTeam.Lux?14:Width-14,Height*.5f);
        private int nextId,tick; private double accumulator;
        private int nextDropId;private readonly System.Random dropRandom;
        private readonly List<ArenaFieldDrop> drops=new List<ArenaFieldDrop>();
        public IReadOnlyList<ArenaFieldDrop> Drops {get;}
        public int RemainingUnits(ArenaTeam team)=>units.Count(u=>u.Team==team&&u.State.Alive);
        private bool CoreAlive(ArenaTeam team)=>units.Any(u=>u.Team==team&&u.Core&&u.State.Alive);
        private bool CanRespawn(ArenaTeam team)=>Time<OfflineMatchRules.MatchLimit&&CoreAlive(team);
        private void CheckElimination(){
            if(Finished)return;int lux=RemainingUnits(ArenaTeam.Lux),ten=RemainingUnits(ArenaTeam.Tenebra);
            if(lux==0||ten==0){Winner=lux==ten?(ArenaTeam?)null:lux==0?ArenaTeam.Tenebra:ArenaTeam.Lux;Finished=true;waves.EndMatch(Winner);drops.Clear();}
        }
        private readonly IBattleNavigation navigation;
        public IReadOnlyList<BattleUnit> Units {get;}
        public BattleUnit Player {get;}
        public float Time=>tick*Step;
        public bool Finished {get;private set;}
        public ArenaTeam? Winner {get;private set;}
        public OfflineBattle(string hero,IBattleNavigation navigation=null,int seed=1){
            this.navigation=navigation;dropRandom=new System.Random(seed);Drops=drops.AsReadOnly();
            HeroKitCatalog.Get(hero);
            Units=units.AsReadOnly();
            foreach(var c in OriginalCover)cover.Add((new Vector2(c.x*Width,c.y*Height),c.z*Height,float.PositiveInfinity));
            var roster=HeroKitCatalog.All;
            var lanes=new[]{ArenaLane.Top,ArenaLane.Mid,ArenaLane.Mid,ArenaLane.Bottom,ArenaLane.Bottom};
            foreach(ArenaTeam team in Enum.GetValues(typeof(ArenaTeam))){
                bool lux=team==ArenaTeam.Lux;
                var picks=new List<string>();
                if(lux)picks.Add(hero);
                for(int j=0;picks.Count<5&&j<roster.Count;j++){
                    string candidate=roster[(j+(lux?5:8))%roster.Count].Id;
                    if(!picks.Contains(candidate))picks.Add(candidate);
                }
                for(int i=0;i<5;i++){
                    string id=picks[i];
                    var u=Add(team,BattleTargetKind.Hero,new SkillActor(id),new Vector2(lux?17:Width-17,Height*.5f+(i-2)*5),lanes[i]);
                    if(lux&&i==0)Player=u;
                }
                foreach(ArenaLane lane in Enum.GetValues(typeof(ArenaLane)))Add(team,BattleTargetKind.Structure,new SkillActor(340),new Vector2(lux?35:Width-35,LaneY[(int)lane]),lane);
                Add(team,BattleTargetKind.Structure,new SkillActor(600),new Vector2(lux?14:Width-14,Height*.5f),ArenaLane.Mid,true);
                var village=new VillageSystem(team,waves,this);villages[(int)team]=village;
                for(int i=0;i<village.Members.Count;i++){
                    var member=village.Members[i];var pos=Base(team)+new Vector2((i-2.5f)*(lux?1:-1),1.5f);
                    var u=Add(team,BattleTargetKind.Villager,new SkillActor(200),pos,ArenaLane.Mid);u.Villager=member;
                }
            }
        }
        private BattleUnit Add(ArenaTeam team,BattleTargetKind kind,SkillActor state,Vector2 p,ArenaLane lane,bool core=false,bool temporary=false,MinionRole role=MinionRole.Infantry){
            var u=new BattleUnit(++nextId,team,kind,state,p,lane,core,temporary,role);units.Add(u);byState.Add(state,u);return u;
        }
        private BattleUnit Find(SkillActor a)=>a!=null&&byState.TryGetValue(a,out var u)?u:null;
        private bool CoreOpen(ArenaTeam team)=>OfflineMatchRules.CoreOpen(units.Where(u=>u.Team==team&&u.Kind==BattleTargetKind.Structure&&!u.Core&&!u.Temporary).Select(u=>u.State.Alive));
        private bool Attackable(BattleUnit u)=>u.State.Alive&&(!u.Core||CoreOpen(u.Team));
        private static bool Finite(Vector2 v)=>!float.IsNaN(v.x)&&!float.IsInfinity(v.x)&&!float.IsNaN(v.y)&&!float.IsInfinity(v.y);
        private bool Blocked(Vector2 p,float radius=1){
            if(!Finite(p)||p.x<2||p.y<2||p.x>Width-2||p.y>Height-2)return true;
            foreach(var c in cover)if(c.expires>Time&&Vector2.Distance(c.position,p)<c.radius+radius)return true;
            return false;
        }
        private bool Move(BattleUnit u,Vector2 direction,float distance){
            if(Finished||u==null||!u.State.Alive||u.State.Buff("stun",Time)>0||!Finite(direction)||direction.sqrMagnitude<.0025f||distance<=0)return false;
            Vector2 p=u.Position,d=direction.normalized;int slices=Mathf.Max(1,Mathf.CeilToInt(distance/.35f));
            for(int i=0;i<slices;i++){var at=p+d*(distance/slices);if(Blocked(at)||(navigation!=null&&!navigation.CanTraverse(p,at)))break;p=at;}
            if(p==u.Position)return false;u.Position=p;return true;
        }
        private static float Dist(BattleUnit a,BattleUnit b)=>Vector2.Distance(a.Position,b.Position);
        public IReadOnlyList<SkillActor> Enemies(SkillActor actor,float radius,Vector2 aim){
            var a=Find(actor);if(a==null)return Array.Empty<SkillActor>();
            var list=units.Where(u=>u.Team!=a.Team&&Attackable(u)&&Dist(a,u)<=radius&&OfflineMatchRules.InAimCone(u.Position-a.Position,aim));
            return (aim.sqrMagnitude<.01f?list.OrderBy(u=>Dist(a,u)):list.OrderByDescending(u=>OfflineMatchRules.AimScore(u.Position-a.Position,aim))).ThenBy(u=>u.Id).Select(u=>u.State).ToArray();
        }
        public IReadOnlyList<SkillActor> Allies(SkillActor actor,float radius){
            var a=Find(actor);if(a==null)return Array.Empty<SkillActor>();
            return units.Where(u=>u.Team==a.Team&&u.Kind==BattleTargetKind.Hero&&u.State.Alive&&Dist(a,u)<=radius).OrderBy(u=>u.Id).Select(u=>u.State).ToArray();
        }
        public bool Hit(SkillActor actor,SkillActor target,float damage){
            var a=Find(actor);var t=Find(target);
            if(Finished||a==null||t==null||!actor.Alive||a.Team==t.Team||!Attackable(t)||float.IsNaN(damage)||float.IsInfinity(damage)||damage<0)return false;
            float n=OfflineMatchRules.Damage(Mathf.Clamp(damage,0,300),a.Gear.Contains("blade"),t.Gear.Contains("armor"));
            n*=1-Mathf.Clamp(actor.Buff("weaken",Time),0,.3f);n*=1+Mathf.Clamp(actor.Buff("fury",Time),0,.3f);
            n*=1-Mathf.Clamp(target.Buff("guard",Time),0,.4f);n*=1+Mathf.Clamp(target.Buff("vulnerable",Time),0,.2f);
            if(t.Kind==BattleTargetKind.Minion)n*=1-Mathf.Clamp01(MinionCombatRules.Stats(t.Role).Defense-target.Buff("armor_break",Time));
            float actual=target.Absorb(n,Time);
            if(n>0&&a.Kind==BattleTargetKind.Hero&&t.Kind==BattleTargetKind.Hero){
                t.RecentHeroDamage[a.Id]=Time;
                foreach(var tower in ActiveTowers(t.Team))if(Dist(tower,t)<=10&&Dist(tower,a)<=10){tower.AggressorId=a.Id;tower.AggroUntil=Time+3;}
            }
            if(t.Villager!=null){t.Villager.Damage(actual);target.Health=t.Villager.Health;}
            else target.Health=Mathf.Max(0,target.Health-actual);
            if(actor.Kit?.Id=="mitch")target.Set("vulnerable",.1f,Time+3,Time);
            if(target.Kit?.Id=="trudice"&&actual>0)actor.Health=Mathf.Max(1,actor.Health-actual*Mathf.Clamp(target.Buff("reflect",Time),0,.3f));
            if(!target.Alive){
                if(a.Kind==BattleTargetKind.Hero&&t.Kind!=BattleTargetKind.Villager){a.Gold=Mathf.Min(9999,a.Gold+(t.Kind==BattleTargetKind.Hero?75:t.Kind==BattleTargetKind.Structure?45:22));GainXp(a,t.Kind==BattleTargetKind.Hero?90:t.Kind==BattleTargetKind.Structure?65:16);}
                if(t.Kind==BattleTargetKind.Hero){
                    t.Deaths++;t.RespawnAt=Time+7.5f;
                    if(a.Kind==BattleTargetKind.Hero)a.Kills++;
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
                else if(t.Kind==BattleTargetKind.Structure&&!t.Temporary)waves.TowerDestroyed(t.Team);
                if(a.Kind==BattleTargetKind.Hero&&!t.Temporary&&t.Kind!=BattleTargetKind.Villager)RollDrop(a,t);
                CheckElimination();
            }
            return true;
        }
        private void RollDrop(BattleUnit killer,BattleUnit target){
            double chance=target.Kind==BattleTargetKind.Hero?1:target.Kind==BattleTargetKind.Structure?.4:.15;
            if(dropRandom.NextDouble()>=chance)return;
            var item=ArenaPickupCatalog.Roll(killer.State.Kit.Id,killer.State.Level,dropRandom.NextDouble);
            if(drops.Count>=ArenaPickupCatalog.Limit)drops.RemoveAt(0);
            drops.Add(new ArenaFieldDrop(++nextDropId,item,target.Position,killer.Team,Time));
        }
        public bool CollectPlayerPickup(int id)=>CollectPickup(Player,id);
        private bool CollectPickup(BattleUnit u,int id){
            if(Finished||!u.State.Alive||u.State.Kit==null)return false;
            var d=drops.Find(x=>x.Id==id);var s=u.State;
            if(!ArenaPickupCatalog.Eligible(d,s.Kit.Id,s.Level,u.Team,u.Position,Time))return false;
            var item=d.Item;float v=item.Value,amount=0;
            switch(item.Effect){
                case "health":float hp=s.Health;s.Heal(v);amount=s.Health-hp;break;
                case "mana":amount=Mathf.Max(0,Mathf.Min(v,100-s.Mana));s.Mana+=amount;break;
                case "shield":amount=s.PickupShield(v,Time);break;
                case "xp":if(s.Level<15){amount=Mathf.Round(v);GainXp(u,amount);}break;
                case "wood":case "gold":case "stone":amount=(float)villages[(int)u.Team].CreditPickup(item.Effect,Mathf.Round(v));break;
                case "cooldown":amount=s.ReduceActiveCooldowns(v/1000,Time);break;
                case "haste":case "fury":case "guard":case "regen":s.Set(item.Effect,v,Time+item.Duration,Time);amount=v;break;
            }
            if(amount<=0)return false;drops.Remove(d);return true;
        }
        private void CollectNearby(BattleUnit u){for(int i=drops.Count-1;i>=0;i--)if(CollectPickup(u,drops[i].Id))break;}
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
        public bool CastPlayer(SkillSlot slot,Vector2 aim)=>Player.State.TryCast(this,slot,aim,Time,!Finished);
        public bool PlayerAttack(Vector2 aim)=>Basic(Player,aim);
        public bool BuyPlayer(string item)=>Buy(Player,item);
        private bool Buy(BattleUnit u,string item){int gold=u.Gold;bool ok=OfflineMatchRules.TryBuy(item,u.Gear,ref gold,Vector2.Distance(u.Position,u.Spawn),u.State.Alive,!Finished);u.Gold=gold;return ok;}
        private bool Basic(BattleUnit u,Vector2 aim){
            var a=u.State;var k=a.Kit;if(Finished||!a.Alive||k==null||a.Buff("stun",Time)>0||Time-u.LastAttack<k.BasicCooldown)return false;
            var targets=Enemies(a,k.BasicRange,aim);if(targets.Count==0)return false;
            if(!Hit(a,targets[0],k.BasicDamage))return false;u.LastAttack=Time;return true;
        }
        private static void GainXp(BattleUnit u,float n){
            var a=u.State;if(a.Kit==null||!a.Alive)return;u.Xp+=n;
            while(a.Level<15){float threshold=65*a.Level+18*a.Level*a.Level;if(u.Xp<threshold)break;u.Xp-=threshold;a.Level++;a.MaxHealth+=8;a.Heal(22);a.Mana=Mathf.Min(100,a.Mana+12);}
        }
        private bool Spawn(MinionSpawn m){
            if(units.Count(u=>u.Kind==BattleTargetKind.Minion&&u.State.Alive)>=240)return false;
            var stats=MinionCombatRules.Stats(m.Role);
            var u=Add(m.Team,BattleTargetKind.Minion,new SkillActor(stats.Health*m.Power),new Vector2(m.Team==ArenaTeam.Lux?19:Width-19,LaneY[(int)m.Lane]),m.Lane,role:m.Role);u.Power=m.Power;return true;
        }
        private int Towers(ArenaTeam team)=>units.Count(u=>u.Team==team&&u.Kind==BattleTargetKind.Structure&&!u.Core&&!u.Temporary&&u.State.Alive);
        public void Advance(float seconds,Vector2 playerMove){
            if(Finished||float.IsNaN(seconds)||float.IsInfinity(seconds)||seconds<0)return;
            accumulator+=Math.Min(seconds,.5f);
            while(accumulator+1e-7>=Step&&!Finished){accumulator-=Step;Tick(Vector2.ClampMagnitude(Finite(playerMove)?playerMove:Vector2.zero,1));}
        }
        private void Tick(Vector2 move){
            tick++;cover.RemoveAll(c=>c.expires<=Time);fallen.RemoveAll(f=>Time-f.Time>25);
            drops.RemoveAll(d=>Time-d.SpawnedAt>=ArenaPickupCatalog.Lifetime);
            foreach(var m in waves.Advance(Step,Towers(ArenaTeam.Lux),Towers(ArenaTeam.Tenebra)))Spawn(m);
            foreach(var village in villages)village.Advance(Step);
            foreach(var u in units)if(u.Villager!=null)u.State.Health=u.Villager.Health;
            if(tick%10==0)VillageAuras();
            var copy=units.ToArray();
            foreach(var u in copy){
                if(Finished)break;var a=u.State;if(u.Villager!=null)continue;
                if(u.Temporary&&u.Expires<=Time)a.Health=0;
                if(!a.Alive){
                    if(u.Kind==BattleTargetKind.Hero&&CanRespawn(u.Team)&&Time>=u.RespawnAt){a.Respawn();u.Position=u.Spawn;u.Retreat=false;}
                    continue;
                }
                if(u.Kind==BattleTargetKind.Hero){
                    a.Heal(a.Buff("regen",Time)*Step);
                    if(tick%10==0){u.Gold=Mathf.Min(9999,u.Gold+2);GainXp(u,3);}
                    if(CanRespawn(u.Team)&&Vector2.Distance(u.Position,u.Spawn)<10){a.Heal(.8f);a.Mana=Mathf.Min(100,a.Mana+.8f);}
                    float speed=OfflineMatchRules.MoveSpeed(a.Kit.Speed,u.Gear.Contains("boots"))*(1+a.Buff("haste",Time))*(1-Mathf.Clamp(a.Buff("slow",Time),0,.45f));
                    if(u==Player){Move(u,move,speed*move.magnitude*Step);CollectNearby(u);continue;}
                    Bot(u,speed);if(!Finished)CollectNearby(u);
                }else if(u.Kind==BattleTargetKind.Minion)Minion(u);
                else Structure(u);
            }
            for(int i=units.Count-1;i>=0;i--){var u=units[i];if(!u.State.Alive&&(u.Kind==BattleTargetKind.Minion||u.Temporary)){byState.Remove(u.State);units.RemoveAt(i);}}
            CheckElimination();
            // 15 minutes is reinforcement cutoff, not an arbitrary winner. If neither faction can move/attack, draw rather than award a false victory.
            if(!Finished&&Time>=OfflineMatchRules.MatchLimit&&!units.Any(u=>u.State.Alive&&(u.Kind==BattleTargetKind.Hero||u.Kind==BattleTargetKind.Minion&&u.Role!=MinionRole.Healer))){Finished=true;Winner=null;waves.EndMatch(null);drops.Clear();}
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
            if(Vector2.Distance(u.Position,u.Spawn)<12)foreach(var item in new[]{"blade","armor","boots"})Buy(u,item);
            if(u.Retreat){Steer(u,u.Spawn-u.Position,speed);return;}
            var t=units.Where(v=>v.Team!=u.Team&&Attackable(v)&&Dist(u,v)<=18).OrderByDescending(v=>18-Dist(u,v)+(1-v.State.Health/v.State.MaxHealth)*7+(v.Core?9:v.Kind==BattleTargetKind.Hero?3.5f:v.Kind==BattleTargetKind.Structure?2:0)).ThenBy(v=>v.Id).FirstOrDefault();
            if(t==null&&(!CoreAlive((ArenaTeam)(1-(int)u.Team))||Time>=OfflineMatchRules.MatchLimit))t=units.Where(v=>v.Team!=u.Team&&Attackable(v)).OrderBy(v=>Dist(u,v)).ThenBy(v=>v.Id).FirstOrDefault();
            var goal=t==null?LaneGoal(u):t.Position;
            if(t!=null&&t.Kind==BattleTargetKind.Structure&&t.State.Health>80&&!units.Any(v=>v.Team==u.Team&&v.Kind==BattleTargetKind.Minion&&v.State.Alive&&Dist(v,t)<12)&&Dist(u,t)<11){Steer(u,u.Position-t.Position,speed);return;}
            if(t==null||Dist(u,t)>Mathf.Max(1.5f,a.Kit.BasicRange*.82f))Steer(u,goal-u.Position,speed);
            if(t==null||tick%6!=0)return;
            var dir=t.Position-u.Position;Basic(u,dir);a.TryCast(this,SkillSlot.Primary,dir,Time,!Finished);
            if(Enemies(a,8,Vector2.zero).Count>=2)a.TryCast(this,SkillSlot.Secondary,dir,Time,!Finished);
            if(Enemies(a,8,Vector2.zero).Count>=3)a.TryCast(this,SkillSlot.Ultimate,dir,Time,!Finished);
        }
        private void Minion(BattleUnit u){
            var s=MinionCombatRules.Stats(u.Role);
            var candidates=units.Where(v=>v!=u&&(v.Kind!=BattleTargetKind.Villager||!CoreAlive(v.Team)||Time>=OfflineMatchRules.MatchLimit)&&v.State.Alive&&Dist(u,v)<=s.RangeSourceUnits/40).Select(v=>new BattleTarget(v.Id,v.Team,v.Kind,Dist(u,v)*40,true,Attackable(v),v.State.MaxHealth-v.State.Health));
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
        private IEnumerable<BattleUnit> ActiveTowers(ArenaTeam team)=>units.Where(u=>u.Team==team&&u.Kind==BattleTargetKind.Structure&&!u.Core&&!u.Temporary&&u.State.Alive);
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
            if(Time-u.LastAttack<1)return;
            bool guardian=!u.Core&&!u.Temporary;
            var t=units.Where(v=>v.Team!=u.Team&&Attackable(v)&&Dist(u,v)<=10)
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
