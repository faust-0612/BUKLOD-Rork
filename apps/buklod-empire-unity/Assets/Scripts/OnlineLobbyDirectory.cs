#if UNITY_EDITOR || UNITY_SERVER
using System;
using System.Collections.Generic;
using System.Linq;
namespace Buklod.Empire {
    public enum OnlineMode {Casual,Ranked}
    public enum LobbyPhase {Forming,Draft,ReservationPending,Reserved,HandedOff,Cancelled}
    // Trusted control-plane only. Identity comes from validated authentication, not a request body.
    public sealed class DraftReservationRequest {
        public readonly Guid MatchId;
        public readonly OnlineMode Mode;
        public readonly string Region,LuxBan,TenebraBan,LuxBanAccount,TenebraBanAccount;
        public readonly IReadOnlyList<ArenaDraftPick> Picks;
        internal DraftReservationRequest(Guid id,OnlineMode mode,string region,string luxBan,string tenebraBan,ArenaDraftPick[] picks){
            MatchId=id;Mode=mode;Region=region;LuxBan=luxBan;TenebraBan=tenebraBan;Picks=Array.AsReadOnly(picks);
            LuxBanAccount=luxBan==null?null:picks.First(p=>p.Team==ArenaTeam.Lux).Player;
            TenebraBanAccount=tenebraBan==null?null:picks.First(p=>p.Team==ArenaTeam.Tenebra).Player;
        }
    }
    public sealed class LobbyMemberSnapshot {
        public readonly string Account,Hero;public readonly ArenaTeam Team;
        internal LobbyMemberSnapshot(string account,string hero,ArenaTeam team){Account=account;Hero=hero;Team=team;}
    }
    public sealed class LobbySnapshot {
        public readonly Guid Id;public readonly LobbyPhase Phase;public readonly OnlineMode Mode;
        public readonly string Region,Owner,LuxBan,TenebraBan;
        public readonly IReadOnlyList<LobbyMemberSnapshot> Members;
        internal LobbySnapshot(Guid id,LobbyPhase phase,OnlineMode mode,string region,string owner,string luxBan,string tenebraBan,LobbyMemberSnapshot[] members){
            Id=id;Phase=phase;Mode=mode;Region=region;Owner=owner;LuxBan=luxBan;TenebraBan=tenebraBan;Members=Array.AsReadOnly(members);
        }
    }
    public sealed class OnlineLobbyDirectory {
        const int MaxRooms=64,MaxQueued=640,MaxInvitesPerRoom=10;
        static readonly TimeSpan QueueLife=TimeSpan.FromMinutes(2),RoomLife=TimeSpan.FromMinutes(5),InviteLife=TimeSpan.FromMinutes(2);
        sealed class Member {public string Account,Hero;public ArenaTeam Team;}
        sealed class Room {
            public Guid Id;public string Owner,Region,LuxBan,TenebraBan;public OnlineMode Mode;public LobbyPhase Phase;
            public DateTimeOffset Expires;public bool Private,LuxBanDone,TenebraBanDone;
            public readonly List<Member> Members=new List<Member>();
            public readonly Dictionary<string,DateTimeOffset> Invites=new Dictionary<string,DateTimeOffset>(StringComparer.Ordinal);
            public DraftReservationRequest Request;
        }
        sealed class Entry {public string Account,Region;public OnlineMode Mode;public DateTimeOffset Expires;}
        readonly Dictionary<Guid,Room> rooms=new Dictionary<Guid,Room>();
        readonly Dictionary<string,Guid> membership=new Dictionary<string,Guid>(StringComparer.Ordinal);
        readonly List<Entry> queue=new List<Entry>();
        readonly HashSet<string> regions;
        readonly Func<DateTimeOffset> now;
        readonly int ownerThread=System.Threading.Thread.CurrentThread.ManagedThreadId;
        public OnlineLobbyDirectory(IEnumerable<string> allowedRegions,Func<DateTimeOffset> clock=null){
            regions=new HashSet<string>(allowedRegions??throw new ArgumentNullException(nameof(allowedRegions)),StringComparer.Ordinal);
            if(regions.Count==0||regions.Any(x=>string.IsNullOrWhiteSpace(x)||x.Length>32))throw new ArgumentException("Invalid region configuration.");
            var start=DateTimeOffset.UtcNow;var elapsed=System.Diagnostics.Stopwatch.StartNew();now=clock??(()=>start+elapsed.Elapsed);
        }
        void Owner(){if(System.Threading.Thread.CurrentThread.ManagedThreadId!=ownerThread)throw new InvalidOperationException("Use lobby owner thread.");}
        static bool Account(string id)=>!string.IsNullOrWhiteSpace(id)&&id.Length<=128;
        bool Available(string account)=>Account(account)&&!membership.ContainsKey(account)&&!queue.Any(q=>q.Account==account);
        bool ValidMode(OnlineMode mode)=>Enum.IsDefined(typeof(OnlineMode),mode);
        Room Find(Guid id)=>rooms.TryGetValue(id,out var r)?r:null;
        Member Find(Room r,string account)=>r?.Members.FirstOrDefault(m=>m.Account==account);
        Member Captain(Room r,ArenaTeam team)=>r.Members.FirstOrDefault(m=>m.Team==team);
        void Add(Room r,string account,ArenaTeam team){r.Members.Add(new Member{Account=account,Team=team});membership.Add(account,r.Id);}
        Room New(string owner,string region,OnlineMode mode,bool priv){
            var r=new Room{Id=Guid.NewGuid(),Owner=owner,Region=region,Mode=mode,Private=priv,Phase=LobbyPhase.Forming,Expires=now()+RoomLife};
            rooms.Add(r.Id,r);return r;
        }
        public Guid CreatePrivate(string account,string region,OnlineMode mode){
            Owner();Sweep();
            if(!Available(account)||!regions.Contains(region??"")||!ValidMode(mode)||rooms.Count>=MaxRooms)return Guid.Empty;
            var r=New(account,region,mode,true);Add(r,account,ArenaTeam.Lux);return r.Id;
        }
        public bool Invite(Guid id,string actor,string target){
            Owner();Sweep();var r=Find(id);
            if(r==null||!r.Private||r.Phase!=LobbyPhase.Forming||r.Owner!=actor||!Available(target)||r.Members.Count>=10||
                !r.Invites.ContainsKey(target)&&r.Invites.Count>=MaxInvitesPerRoom)return false;
            r.Invites[target]=now()+InviteLife;return true;
        }
        public bool JoinPrivate(Guid id,string account,ArenaTeam team){
            Owner();Sweep();var r=Find(id);
            if(r==null||!r.Private||r.Phase!=LobbyPhase.Forming||!Available(account)||!ArenaDraftRules.ValidTeam(team)||
               r.Members.Count(m=>m.Team==team)>=5||!r.Invites.TryGetValue(account,out var expiry)||expiry<=now())return false;
            r.Invites.Remove(account);Add(r,account,team);return true;
        }
        public bool Enqueue(string account,string region,OnlineMode mode){
            Owner();Sweep();
            if(!Available(account)||!regions.Contains(region??"")||!ValidMode(mode)||queue.Count>=MaxQueued)return false;
            queue.Add(new Entry{Account=account,Region=region,Mode=mode,Expires=now()+QueueLife});return true;
        }
        public bool CancelQueue(string account){Owner();return queue.RemoveAll(q=>q.Account==account)>0;}
        // FIFO inside mode and region, not a skill rating algorithm. No cross-region mixing.
        public Guid FormQueued(string region,OnlineMode mode){
            Owner();Sweep();if(rooms.Count>=MaxRooms||!regions.Contains(region??"")||!ValidMode(mode))return Guid.Empty;
            var picks=queue.Where(q=>q.Region==region&&q.Mode==mode).Take(10).ToArray();
            if(picks.Length!=10)return Guid.Empty;
            var r=New(picks[0].Account,region,mode,false);
            for(int i=0;i<picks.Length;i++){queue.Remove(picks[i]);Add(r,picks[i].Account,i%2==0?ArenaTeam.Lux:ArenaTeam.Tenebra);}
            BeginDraft(r);return r.Id;
        }
        void BeginDraft(Room r){r.Phase=LobbyPhase.Draft;r.Expires=now()+RoomLife;r.Invites.Clear();}
        public bool StartDraft(Guid id,string actor){
            Owner();Sweep();var r=Find(id);
            if(r==null||r.Owner!=actor||r.Phase!=LobbyPhase.Forming||r.Members.Count!=10||r.Members.Count(m=>m.Team==ArenaTeam.Lux)!=5)return false;
            BeginDraft(r);return true;
        }
        // Ban intent only: the transactional reservation must still authorize and debit the matching stone.
        // Ranked draft bans remain disabled until a separately approved ranked policy exists.
        public bool Ban(Guid id,string actor,string hero){
            Owner();Sweep();var r=Find(id);var m=Find(r,actor);
            if(m==null||r.Phase!=LobbyPhase.Draft||Captain(r,m.Team)!=m||r.Members.Any(x=>x.Hero!=null))return false;
            if(hero!=null&&(r.Mode==OnlineMode.Ranked||!ArenaDraftRules.Known(hero)||hero==r.LuxBan||hero==r.TenebraBan))return false;
            if(m.Team==ArenaTeam.Lux){if(r.LuxBanDone)return false;r.LuxBan=hero;r.LuxBanDone=true;}
            else{if(r.TenebraBanDone)return false;r.TenebraBan=hero;r.TenebraBanDone=true;}
            return true;
        }
        public bool Pick(Guid id,string actor,string hero){
            Owner();Sweep();var r=Find(id);var m=Find(r,actor);
            if(m==null||r.Phase!=LobbyPhase.Draft||!r.LuxBanDone||!r.TenebraBanDone||m.Hero!=null||!ArenaDraftRules.Known(hero)||hero==r.LuxBan||hero==r.TenebraBan||r.Members.Any(x=>x.Hero==hero))return false;
            m.Hero=hero;return true;
        }
        public DraftReservationRequest LockDraft(Guid id,string actor){
            Owner();Sweep();var r=Find(id);
            if(r==null||r.Owner!=actor||r.Phase!=LobbyPhase.Draft)return null;
            var picks=r.Members.Select(m=>new ArenaDraftPick(m.Account,m.Hero,m.Team)).ToArray();
            if(!ArenaDraftRules.Valid(picks,r.LuxBan,r.TenebraBan))return null;
            r.Request=new DraftReservationRequest(r.Id,r.Mode,r.Region,r.LuxBan,r.TenebraBan,picks);r.Phase=LobbyPhase.ReservationPending;
            return r.Request;
        }
        // Trusted persistence worker only: true means durable, exact match-ID reservation verified.
        // Ambiguous timeout is NOT failure; leave pending and reconcile before retry/cancel.
        internal bool ConfirmReservation(Guid id,bool durableSuccess){
            Owner();var r=Find(id);if(r==null||r.Phase!=LobbyPhase.ReservationPending)return false;
            if(!durableSuccess){Remove(r);return true;}
            r.Phase=LobbyPhase.Reserved;return true;
        }
        internal DraftReservationRequest InspectReserved(Guid id){Owner();var r=Find(id);return r!=null&&r.Phase==LobbyPhase.Reserved?r.Request:null;}
        internal DraftReservationRequest TakeReserved(Guid id){
            Owner();var r=Find(id);if(r==null||r.Phase!=LobbyPhase.Reserved)return null;
            r.Phase=LobbyPhase.HandedOff;return r.Request;
        }
        // Only after durable settlement or refund. Do not release identity while money is unresolved.
        internal bool Complete(Guid id){Owner();var r=Find(id);if(r==null||r.Phase!=LobbyPhase.HandedOff&&r.Phase!=LobbyPhase.Reserved)return false;Remove(r);return true;}
        public bool Leave(Guid id,string actor){
            Owner();Sweep();var r=Find(id);var m=Find(r,actor);
            if(m==null||r.Phase!=LobbyPhase.Forming&&r.Phase!=LobbyPhase.Draft)return false;
            if(r.Owner==actor||r.Phase==LobbyPhase.Draft){Remove(r);return true;}
            r.Members.Remove(m);membership.Remove(actor);return true;
        }
        public LobbySnapshot Snapshot(Guid id,string actor){
            Owner();Sweep();var r=Find(id);if(Find(r,actor)==null)return null;
            return new LobbySnapshot(r.Id,r.Phase,r.Mode,r.Region,r.Owner,r.LuxBan,r.TenebraBan,r.Members.Select(m=>new LobbyMemberSnapshot(m.Account,m.Hero,m.Team)).ToArray());
        }
        public Guid RoomFor(string account){Owner();Sweep();return account!=null&&membership.TryGetValue(account,out var id)?id:Guid.Empty;}
        void Remove(Room r){r.Phase=LobbyPhase.Cancelled;foreach(var m in r.Members)membership.Remove(m.Account);rooms.Remove(r.Id);}
        public void Sweep(){
            Owner();var at=now();queue.RemoveAll(q=>q.Expires<=at);
            foreach(var r in rooms.Values.ToArray()){
                if((r.Phase==LobbyPhase.Forming||r.Phase==LobbyPhase.Draft)&&r.Expires<=at){Remove(r);continue;}
                foreach(var key in r.Invites.Where(kv=>kv.Value<=at).Select(kv=>kv.Key).ToArray())r.Invites.Remove(key);
            }
        }
    }
}
#endif
