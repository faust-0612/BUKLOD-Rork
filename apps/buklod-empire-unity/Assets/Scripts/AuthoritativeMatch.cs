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
        public readonly string Hero;public readonly Vector2 Position;public readonly float Health,MaxHealth;
        public readonly bool Alive;
        internal MatchUnitSnapshot(BattleUnit u){Id=u.Id;Team=u.Team;Kind=u.Kind;Hero=u.State.Kit?.Id;Position=u.Position;Health=u.State.Health;MaxHealth=u.State.MaxHealth;Level=u.State.Level;Alive=u.State.Alive;}
    }
    public sealed class MatchSnapshot {
        public readonly int Tick,OwnUnitId,Gold;public readonly long AcceptedSequence,AppliedSequence;
        public readonly bool LastActionSucceeded,Finished;public readonly ArenaTeam? Winner;
        public readonly string EndReason;public readonly float Mana,MaxMana,Xp;
        public readonly IReadOnlyList<MatchUnitSnapshot> Units;
        internal MatchSnapshot(int tick,BattleUnit own,long accepted,long applied,bool success,OfflineBattle battle){
            Tick=tick;OwnUnitId=own.Id;Gold=own.Gold;Mana=own.State.Mana;MaxMana=own.State.MaxMana;Xp=own.Xp;
            AcceptedSequence=accepted;AppliedSequence=applied;LastActionSucceeded=success;Finished=battle.Finished;Winner=battle.Winner;EndReason=battle.EndReason;
            Units=Array.AsReadOnly(battle.Units.Where(u=>u.Team==own.Team||battle.IsVisibleTo(own.Team,u)).OrderBy(u=>u.Id).Select(u=>new MatchUnitSnapshot(u)).ToArray());
        }
    }
    // Single-threaded trusted server core. Authentication/transport must resolve the verified
    // player key before invoking these methods. Never expose them directly as anonymous RPCs.
    public sealed class AuthoritativeMatch {
        public const int ParticipantCount=10, MovementExpiryTicks=3;
        private sealed class Slot {
            public bool Connected;
            public long Accepted,Applied;
            public bool Success;
            public int LastMoveTick;
            public Vector2 Move;
            public MatchInput? Pending;
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
        bool Find(string player,out int slot){slot=-1;return player!=null&&owners.TryGetValue(player,out slot);}
        // Called by trusted session lifecycle after identity/lease verification, on the match loop.
        public bool SetConnected(string verifiedPlayer,bool connected){
            if(!Find(verifiedPlayer,out int i)||Finished)return false;
            var s=slots[i];if(s.Connected==connected)return true;
            s.Connected=connected;s.Pending=null;s.Move=Vector2.zero;s.LastMoveTick=0;return true;
        }
        public bool ConfigureLoadout(string verifiedPlayer,ArenaTactic tactic,CovenantLoadout covenant)=>Tick==0&&Find(verifiedPlayer,out int i)&&battle.ConfigureParticipant(i,tactic,covenant);
        // Exactly one bounded frame per slot per next simulation tick. Reject duplicate,
        // stale, far-future and disconnected submissions; sequence persists across reconnect.
        public bool Submit(string verifiedPlayer,MatchInput input){
            if(Finished||!Find(verifiedPlayer,out int i)||!input.Valid()||input.Tick!=Tick+1)return false;
            var s=slots[i];if(!s.Connected||s.Pending.HasValue||input.Sequence<=s.Accepted)return false;
            s.Accepted=input.Sequence;s.Pending=input;return true;
        }
        public bool AdvanceTick(){
            if(Finished)return false;
            int next=Tick+1;
            for(int i=0;i<slots.Length;i++){
                var s=slots[i];if(s.Connected&&s.Pending.HasValue){
                    var input=s.Pending.Value;s.Pending=null;s.Move=input.Movement;s.LastMoveTick=next;
                    s.Success=!battle.Finished&&battle.ApplyParticipantAction(i,input);s.Applied=input.Sequence;
                }
                movement[i]=s.Connected&&next-s.LastMoveTick<MovementExpiryTicks?s.Move:Vector2.zero;
            }
            battle.AdvanceAuthoritative(movement);Tick=next;return true;
        }
        public MatchSnapshot Snapshot(string verifiedPlayer){
            if(!Find(verifiedPlayer,out int i)||!slots[i].Connected)return null;
            var s=slots[i];return new MatchSnapshot(Tick,battle.Participant(i),s.Accepted,s.Applied,s.Success,battle);
        }
    }
}
