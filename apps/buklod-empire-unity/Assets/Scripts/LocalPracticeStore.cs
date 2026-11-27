using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using UnityEngine;
namespace Buklod.Empire {
    // Device-local practice statistics only. Never a reward wallet, XP grant,
    // Sacred Stone balance, account identity or server synchronization payload.
    [Serializable] public sealed class PracticeHeroStats {
        public string hero;
        public long completed,wins,losses,draws,kills,deaths,assists;
        public long Mastery=>1+completed/5;
    }
    [Serializable] public sealed class PracticeRecord {
        public int schema=1;
        public long revision;
        public string lastMatch="";
        public PracticeHeroStats[] heroes;
    }
    public sealed class LocalPracticeStore {
        const int MaxBytes=65536;
        readonly string folder;
        PracticeRecord state;
        [Serializable] sealed class Envelope {public string payload,sha256;}
        public LocalPracticeStore(string directory){
            if(string.IsNullOrEmpty(directory))throw new ArgumentException("Missing practice storage path.");
            folder=directory;state=Load();
        }
        static string Hash(string s){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(s))).Replace("-","").ToLowerInvariant();}
        string PathFor(int slot)=>Path.Combine(folder,"practice-v1-"+slot+".json");
        static PracticeRecord Fresh()=>new PracticeRecord{heroes=HeroKitCatalog.All.Select(h=>new PracticeHeroStats{hero=h.Id}).ToArray()};
        static bool Valid(PracticeRecord p){
            if(p==null||p.schema!=1||p.revision<0||p.heroes==null||p.heroes.Length!=13||
               (p.revision==0?p.lastMatch!="":!Guid.TryParseExact(p.lastMatch,"D",out var id)||id==Guid.Empty))return false;
            var ids=new System.Collections.Generic.HashSet<string>(StringComparer.Ordinal);
            long total=0;
            try{checked{foreach(var h in p.heroes){
                if(h==null||!ArenaDraftRules.Known(h.hero)||!ids.Add(h.hero)||h.completed<0||h.wins<0||h.losses<0||h.draws<0||
                   h.kills<0||h.deaths<0||h.assists<0||h.completed!=h.wins+h.losses+h.draws)return false;
                total+=h.completed;
            }}}catch(OverflowException){return false;}
            return total==p.revision;
        }
        PracticeRecord Read(int slot){
            var path=PathFor(slot);if(!File.Exists(path))return null;
            try{
                if(new FileInfo(path).Length>MaxBytes)return null;
                var e=JsonUtility.FromJson<Envelope>(File.ReadAllText(path));
                if(e==null||string.IsNullOrEmpty(e.payload)||e.sha256!=Hash(e.payload))return null;
                var p=JsonUtility.FromJson<PracticeRecord>(e.payload);
                return Valid(p)&&p.revision%2==slot?p:null;
            }catch(IOException){return null;}catch(UnauthorizedAccessException){return null;}catch(ArgumentException){return null;}
        }
        PracticeRecord Load(){
            var a=Read(0);var b=Read(1);
            if(a!=null||b!=null)return b==null||a!=null&&a.revision>b.revision?a:b;
            if(File.Exists(PathFor(0))||File.Exists(PathFor(1)))throw new IOException("No valid local practice record; preserve files for recovery.");
            return Fresh();
        }
        public PracticeHeroStats Stats(string hero){
            if(!ArenaDraftRules.Known(hero))throw new ArgumentException("Unknown hero.");
            // Never expose mutable internal state.
            return JsonUtility.FromJson<PracticeHeroStats>(JsonUtility.ToJson(state.heroes.First(h=>h.hero==hero)));
        }
        public bool Record(Guid matchId,string hero,int outcome,int kills,int deaths,int assists){
            if(matchId==Guid.Empty||!ArenaDraftRules.Known(hero)||outcome< -1||outcome>1||kills<0||deaths<0||assists<0)
                throw new ArgumentException("Invalid practice result.");
            string key=matchId.ToString("D");
            if(state.lastMatch==key)return false;
            // One owner thread and one active match, no historical result import.
            var next=JsonUtility.FromJson<PracticeRecord>(JsonUtility.ToJson(state));
            checked{
                var h=next.heroes.First(x=>x.hero==hero);h.completed++;
                if(outcome==1)h.wins++;else if(outcome==-1)h.losses++;else h.draws++;
                h.kills+=kills;h.deaths+=deaths;h.assists+=assists;next.revision++;
            }
            next.lastMatch=key;if(!Valid(next))throw new InvalidOperationException("Practice state invalid.");
            Directory.CreateDirectory(folder);
            string payload=JsonUtility.ToJson(next),path=PathFor((int)(next.revision%2)),temp=path+".tmp";
            var bytes=Encoding.UTF8.GetBytes(JsonUtility.ToJson(new Envelope{payload=payload,sha256=Hash(payload)}));
            if(bytes.Length>MaxBytes)throw new IOException("Practice record size exceeded.");
            // Two slots: the previously valid slot remains intact until the new
            // complete file is flushed and renamed. No network or Android permission required.
            using(var file=new FileStream(temp,FileMode.Create,FileAccess.Write,FileShare.None)){file.Write(bytes,0,bytes.Length);file.Flush(true);}
            if(File.Exists(path))File.Delete(path);
            File.Move(temp,path);
            var verified=Read((int)(next.revision%2));
            if(verified==null||verified.revision!=next.revision||verified.lastMatch!=key)throw new IOException("Practice save readback failed.");
            state=verified;return true;
        }
    }
}
