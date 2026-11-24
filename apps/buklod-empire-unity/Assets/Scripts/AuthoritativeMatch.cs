using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
namespace Buklod.Empire {
    public enum MatchAction {None,Attack,AttackUnit,AttackCamp,Cast,Recall,Tactic,Buy,Sell,CollectPickup,CollectRelic,WorkerOrder,WorkerResource,Build,Repair,CancelBuild,TradeBuy,TradeSell,Recruit,CancelRecruit}
    // Wire-neutral input. No actor identity, damage, health, gold, XP or outcome fields.
    public readonly struct MatchInput {
        public readonly long Sequence;
        public readonly int Tick,Target;
        public readonly Vector2 Movement,Aim;
        public readonly MatchAction Action;
        public readonly string Text;
        public MatchInput(long sequence,int tick,Vector2 movement,MatchAction action=MatchAction.None,Vector2 aim=default,int target=0,string text=null){
            Sequence=sequence;Tick=tick;Movement=movement;Aim=aim;Action=action;Target=target;Text=text;
        }
        static bool Finite(Vector2 v)=>!float.IsNaN(v.x)&&!float.IsInfinity(v.x)&&!float.IsNaN(v.y)&&!float.IsInfinity(v.y);
        public bool Valid(){
            if(Sequence<=0||Tick<=0||!Finite(Movement)||!Finite(Aim)||Movement.sqrMagnitude>1.0001f||Aim.sqrMagnitude>1.0001f||!Enum.IsDefined(typeof(MatchAction),Action)||(Text!=null&&Text.Length>64))return false;
            switch(Action){
                case MatchAction.Cast:return Target>=0&&Target<=2;
                case MatchAction.AttackUnit:case MatchAction.AttackCamp:case MatchAction.CollectPickup:case MatchAction.CollectRelic:case MatchAction.Repair:return Target>0;
                case MatchAction.Buy:case MatchAction.Sell:return !string.IsNullOrWhiteSpace(Text);
                case MatchAction.WorkerOrder:return !string.IsNullOrWhiteSpace(Text)&&Enum.IsDefined(typeof(VillageWorkerOrder),Target);
                case MatchAction.WorkerResource:return !string.IsNullOrWhiteSpace(Text)&&(Target==-1||Enum.IsDefined(typeof(VillageResourceKind),Target));
                case MatchAction.Build:return Enum.IsDefined(typeof(VillageBuildOrder),Target)&&Target!=(int)VillageBuildOrder.Repair;
                case MatchAction.TradeBuy:case MatchAction.TradeSell:return Enum.IsDefined(typeof(VillageResourceKind),Target)&&Target!=(int)VillageResourceKind.Gold;
                default:return true;
            }
        }
    }
    // Immutable copies, not references to mutable battle actors.
    public readonly struct MatchUnitSnapshot {
        public readonly int Id,Level;public readonly ArenaTeam Team;public readonly BattleTargetKind Kind;
        public readonly bool Core,Temporary,Depot,GuardPost,Farm,Barracks,Market,House;
        public readonly MinionRole Role;public readonly string VillagerVisual,WorkerId;
        public readonly string Hero;public readonly Vector2 Position;public readonly float Health,MaxHealth;
        public readonly bool Alive;
        internal MatchUnitSnapshot(BattleUnit u){Id=u.Id;Team=u.Team;Kind=u.Kind;Hero=u.State.Kit?.Id;Position=u.Position;Health=u.State.Health;MaxHealth=u.State.MaxHealth;Level=u.State.Level;Alive=u.State.Alive;Core=u.Core;Temporary=u.Temporary;Depot=u.IsDepot;GuardPost=u.IsGuardPost;Farm=u.IsFarm;Barracks=u.IsBarracks;Market=u.IsMarket;House=u.IsHouse;Role=u.Role;VillagerVisual=u.Villager?.VisualId;WorkerId=u.Villager?.Job.Id;}
    }
    public readonly struct MatchCampSnapshot {
        public readonly int Id;public readonly WildernessKind Kind;public readonly Vector2 Position;
        public readonly float Health,MaxHealth;public readonly bool Alive,Boss;
        internal MatchCampSnapshot(WildernessCamp c){Id=c.Id;Kind=c.Kind;Position=c.Position;Health=c.Health;MaxHealth=c.MaxHealth;Alive=c.Alive;Boss=c.Boss;}
    }
    public readonly struct MatchResourceSnapshot {
        public readonly int Id,StructureId;public readonly ArenaTeam Team;public readonly VillageResourceKind Kind;
        public readonly Vector2 Position;public readonly double Stock,Capacity;public readonly float CaptureProgress;
        internal MatchResourceSnapshot(VillageResourceNode n){Id=n.Id;StructureId=n.StructureId;Team=n.Team;Kind=n.Kind;Position=n.Position;Stock=n.Stock;Capacity=n.Capacity;CaptureProgress=n.CaptureProgress;}
    }
    public readonly struct MatchDropSnapshot {
        public readonly int Id;public readonly string Item;public readonly Vector2 Position;public readonly float SpawnedAt;public readonly bool Relic;
        internal MatchDropSnapshot(int id,string item,Vector2 position,float spawnedAt,bool relic){Id=id;Item=item;Position=position;SpawnedAt=spawnedAt;Relic=relic;}
    }
    public sealed class MatchSnapshot {
        public readonly int Tick,OwnUnitId,Gold,PopulationUsed,PopulationCapacity;public readonly long AcceptedSequence,AppliedSequence;
        public readonly bool IsRtsController;public readonly ArenaTeam Team;
        public readonly bool LastActionSucceeded,Finished;public readonly ArenaTeam? Winner;
        public readonly string EndReason;public readonly float Mana,MaxMana,Xp;
        public readonly IReadOnlyList<MatchUnitSnapshot> Units;
        public readonly IReadOnlyList<MatchCampSnapshot> Camps;
        public readonly IReadOnlyList<MatchResourceSnapshot> Resources;
        public readonly IReadOnlyList<MatchDropSnapshot> Drops;
        public readonly IReadOnlyList<string> Gear,Relics;
        public readonly IReadOnlyList<double> TeamBalances;
        public readonly IReadOnlyList<float> SkillRemaining;
        public readonly float TacticRemaining;
        internal MatchSnapshot(int tick,BattleUnit own,long accepted,long applied,bool success,OfflineBattle battle,bool captain){
            Tick=tick;OwnUnitId=own.Id;Gold=own.Gold;Mana=own.State.Mana;MaxMana=own.State.MaxMana;Xp=own.Xp;Team=own.Team;IsRtsController=captain;
            PopulationUsed=battle.PopulationUsed(Team);PopulationCapacity=battle.PopulationCapacity(Team);
            var bank=battle.GetVillage(Team);
            TeamBalances=Array.AsReadOnly(Enum.GetValues(typeof(VillageResourceKind)).Cast<VillageResourceKind>().Select(bank.ResourceBalance).ToArray());
            Gear=Array.AsReadOnly(own.Gear.OrderBy(x=>x,StringComparer.Ordinal).ToArray());
            Relics=Array.AsReadOnly(own.Relics.Values.Select(x=>x.Id).OrderBy(x=>x,StringComparer.Ordinal).ToArray());
            SkillRemaining=Array.AsReadOnly(new[]{SkillSlot.Primary,SkillSlot.Secondary,SkillSlot.Ultimate}.Select(slot=>own.State.Remaining(slot,battle.Time)).ToArray());
            TacticRemaining=Mathf.Max(0,own.TacticReadyAt-battle.Time);
            AcceptedSequence=accepted;AppliedSequence=applied;LastActionSucceeded=success;Finished=battle.Finished;Winner=battle.Winner;EndReason=battle.EndReason;
            Units=Array.AsReadOnly(battle.Units.Where(u=>u.Team==own.Team||battle.IsVisibleTo(own.Team,u)).OrderBy(u=>u.Id).Select(u=>new MatchUnitSnapshot(u)).ToArray());
            Camps=Array.AsReadOnly(battle.Camps.Where(c=>battle.IsPositionVisibleTo(Team,c.Position)).OrderBy(c=>c.Id).Select(c=>new MatchCampSnapshot(c)).ToArray());
            Resources=Array.AsReadOnly(battle.ResourceNodes.Where(n=>n.Team==Team||battle.IsPositionVisibleTo(Team,n.Position)).OrderBy(n=>n.Id).Select(n=>new MatchResourceSnapshot(n)).ToArray());
            Drops=Array.AsReadOnly(battle.Drops.Where(d=>battle.IsPositionVisibleTo(Team,d.Position)).Select(d=>new MatchDropSnapshot(d.Id,d.Item.Id,d.Position,d.SpawnedAt,false))
                .Concat(battle.RelicDrops.Where(d=>battle.IsPositionVisibleTo(Team,d.Position)).Select(d=>new MatchDropSnapshot(d.Id,d.Item.Id,d.Position,d.SpawnedAt,true))).OrderBy(d=>d.Relic).ThenBy(d=>d.Id).ToArray());
        }
    }
    // Single-threaded trusted server core. Authentication/transport must resolve the verified
    // player key before invoking these methods. Never expose them directly as anonymous RPCs.
    public sealed class MatchSession {
        internal readonly int Slot;
        internal MatchSession(int slot){Slot=slot;}
    }
    public sealed class AuthoritativeMatch {
        public const int ParticipantCount=10, MovementExpiryTicks=3, MaxInputLead=4;
        private sealed class Slot {
            public MatchSession Session;
            public bool Connected=>Session!=null;
            public long Accepted,Applied;
            public bool Success;
            public int LastMoveTick;
            public Vector2 Move;
            public readonly SortedDictionary<int,MatchInput> Pending=new SortedDictionary<int,MatchInput>();
            public int LastScheduledTick;
        }
        readonly Dictionary<string,int> owners=new Dictionary<string,int>(StringComparer.Ordinal);
        readonly Slot[] slots=new Slot[ParticipantCount];
        readonly Vector2[] movement=new Vector2[ParticipantCount];
        readonly OfflineBattle battle;
        public int Tick {get;private set;}
        public bool Finished=>battle.Finished;
        public AuthoritativeMatch(IReadOnlyList<ArenaDraftPick> picks,int seed,IBattleNavigation navigation=null,string luxBan=null,string tenebraBan=null){
            if(!ArenaDraftRules.Valid(picks,luxBan,tenebraBan)||picks.Any(p=>p.Player.Length>128))throw new ArgumentException("Invalid match draft.");
            var ordered=picks.Where(p=>p.Team==ArenaTeam.Lux).Concat(picks.Where(p=>p.Team==ArenaTeam.Tenebra)).ToArray();
            for(int i=0;i<ParticipantCount;i++){owners.Add(ordered[i].Player,i);slots[i]=new Slot();}
            battle=new OfflineBattle(ordered[0].Hero,navigation,seed,ArenaDifficulty.Normal,false,ordered);
        }
        internal bool ContainsPlayer(string player)=>Find(player,out _);
        bool Find(string player,out int slot){slot=-1;return player!=null&&owners.TryGetValue(player,out slot);}
        // A session handle is an in-process capability, NOT a network credential. The
        // future authenticated transport must store it server-side and never deserialize it.
        bool SessionSlot(MatchSession session,out int i){
            i=session==null?-1:session.Slot;
            return i>=0&&i<slots.Length&&ReferenceEquals(slots[i].Session,session);
        }
        public MatchSession OpenSession(string verifiedPlayer){
            if(!Find(verifiedPlayer,out int i))return null;
            var s=slots[i];s.Pending.Clear();s.LastScheduledTick=Tick;s.Move=Vector2.zero;s.LastMoveTick=0;
            return s.Session=new MatchSession(i);
        }
        public bool CloseSession(MatchSession session){
            if(!SessionSlot(session,out int i))return false;
            var s=slots[i];s.Session=null;s.Pending.Clear();s.LastScheduledTick=Tick;s.Move=Vector2.zero;s.LastMoveTick=0;return true;
        }
        public bool ConfigureLoadout(MatchSession session,ArenaTactic tactic,CovenantLoadout covenant)=>Tick==0&&SessionSlot(session,out int i)&&battle.ConfigureParticipant(i,tactic,covenant);
        // One frame per slot per tick within a bounded lead window; sequence and scheduled tick increase.
        public bool Submit(MatchSession session,MatchInput input){
            if(Finished||!SessionSlot(session,out int i)||!input.Valid()||input.Tick<=Tick||input.Tick>Tick+MaxInputLead)return false;
            var s=slots[i];if(!s.Connected||s.Pending.Count>=MaxInputLead||input.Tick<=s.LastScheduledTick||input.Sequence<=s.Accepted)return false;
            s.Accepted=input.Sequence;s.LastScheduledTick=input.Tick;s.Pending.Add(input.Tick,input);return true;
        }
        public bool AdvanceTick(){
            if(Finished)return false;
            int next=Tick+1;
            for(int offset=0;offset<slots.Length;offset++){
                int i=(next-1+offset)%slots.Length; // deterministic rotation avoids permanent first-slot priority
                var s=slots[i];if(s.Connected&&s.Pending.TryGetValue(next,out var input)){
                    s.Pending.Remove(next);s.Move=input.Movement;s.LastMoveTick=next;
                    s.Success=!battle.Finished&&battle.ApplyParticipantAction(i,input);s.Applied=input.Sequence;
                }
                movement[i]=s.Connected&&next-s.LastMoveTick<MovementExpiryTicks?s.Move:Vector2.zero;
            }
            battle.AdvanceAuthoritative(movement);Tick=next;return true;
        }
        public MatchSnapshot Snapshot(MatchSession session){
            if(!SessionSlot(session,out int i))return null;
            var s=slots[i];return new MatchSnapshot(Tick,battle.Participant(i),s.Accepted,s.Applied,s.Success,battle,i==0||i==5);
        }
    }
}
