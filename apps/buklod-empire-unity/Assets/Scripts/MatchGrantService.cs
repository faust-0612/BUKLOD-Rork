using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;
namespace Buklod.Empire {
    // A verified identity is supplied ONLY by a trusted server-side authentication adapter.
    // This interface does not authenticate a bearer token by itself.
    public interface IMatchIdentityVerifier {
        System.Threading.Tasks.Task<string> VerifyAccountAsync(string bearer,System.Threading.CancellationToken cancellation);
    }
    public sealed class MatchGrantService {
        public const int ProtocolVersion=1;
        public const int TicketSeconds=30, IdleSeconds=15;
        sealed class Grant {public string Account;public DateTimeOffset Expires;}
        sealed class Lease {public MatchSession Session;public DateTimeOffset LastSeen;}
        readonly AuthoritativeMatch match;
        readonly Dictionary<string,Grant> grants=new Dictionary<string,Grant>(StringComparer.Ordinal);
        readonly Dictionary<string,string> byAccount=new Dictionary<string,string>(StringComparer.Ordinal);
        readonly Dictionary<MatchSession,Lease> leases=new Dictionary<MatchSession,Lease>();
        readonly Dictionary<string,MatchSession> current=new Dictionary<string,MatchSession>(StringComparer.Ordinal);
        readonly Func<DateTimeOffset> now;
        public Guid MatchId {get;}
        public MatchGrantService(Guid matchId,AuthoritativeMatch match,Func<DateTimeOffset> clock=null){
            if(matchId==Guid.Empty||match==null)throw new ArgumentException("Invalid match authority.");
            MatchId=matchId;this.match=match;now=clock??(()=>DateTimeOffset.UtcNow);
        }
        // Single match-loop thread only; transport must marshal calls to this owner.
        static string Hash(string text){using(var sha=SHA256.Create())return Convert.ToBase64String(sha.ComputeHash(Encoding.UTF8.GetBytes(text)));}
        internal string IssueVerified(string verifiedAccount){
            Sweep();
            if(match.Finished||!match.ContainsPlayer(verifiedAccount))return null;
            if(byAccount.TryGetValue(verifiedAccount,out var old))grants.Remove(old);
            if(grants.Count>=AuthoritativeMatch.ParticipantCount)return null;
            var bytes=new byte[32];using(var rng=RandomNumberGenerator.Create())rng.GetBytes(bytes);
            string ticket=Convert.ToBase64String(bytes),key=Hash(ticket);
            grants.Add(key,new Grant{Account=verifiedAccount,Expires=now().AddSeconds(TicketSeconds)});
            byAccount[verifiedAccount]=key;return ticket;
        }
        public MatchSession Redeem(Guid matchId,int protocol,string ticket){
            Sweep();
            if(matchId!=MatchId||protocol!=ProtocolVersion||ticket==null||ticket.Length!=44||match.Finished)return null;
            string key=Hash(ticket);
            if(!grants.TryGetValue(key,out var g))return null;
            grants.Remove(key);byAccount.Remove(g.Account);
            if(g.Expires<=now())return null;
            if(current.TryGetValue(g.Account,out var old)){leases.Remove(old);match.CloseSession(old);}
            var session=match.OpenSession(g.Account);if(session==null)return null;
            leases.Add(session,new Lease{Session=session,LastSeen=now()});current[g.Account]=session;return session;
        }
        bool Active(MatchSession s)=>s!=null&&leases.TryGetValue(s,out var l)&&now()-l.LastSeen<TimeSpan.FromSeconds(IdleSeconds);
        public bool Heartbeat(MatchSession s){if(!Active(s))return false;leases[s].LastSeen=now();return true;}
        public bool Submit(MatchSession s,MatchInput frame){
            if(!Active(s)||!match.Submit(s,frame))return false;
            leases[s].LastSeen=now();return true;
        }
        public MatchSnapshot Snapshot(MatchSession s)=>Active(s)?match.Snapshot(s):null;
        public bool Close(MatchSession s){
            if(s==null||!leases.Remove(s))return false;
            string account=null;foreach(var kv in current)if(ReferenceEquals(kv.Value,s)){account=kv.Key;break;}
            if(account!=null)current.Remove(account);
            return match.CloseSession(s);
        }
        public void Sweep(){
            var time=now();var expired=new List<string>();
            foreach(var kv in grants)if(kv.Value.Expires<=time)expired.Add(kv.Key);
            foreach(var key in expired){var g=grants[key];grants.Remove(key);byAccount.Remove(g.Account);}
            var stale=new List<MatchSession>();foreach(var kv in leases)if(time-kv.Value.LastSeen>=TimeSpan.FromSeconds(IdleSeconds))stale.Add(kv.Key);
            foreach(var s in stale)Close(s);
        }
        public bool AdvanceTick(){Sweep();return match.AdvanceTick();}
    }
}
