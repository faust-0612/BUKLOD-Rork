using System;
using System.Collections.Generic;
using System.Linq;
namespace Buklod.Empire {
    public readonly struct ArenaDraftPick {
        public readonly string Player,Hero;public readonly ArenaTeam Team;
        public ArenaDraftPick(string player,string hero,ArenaTeam team){Player=player;Hero=hero;Team=team;}
    }
    // Pure draft validation only. Wallet reservations remain authoritative-server work.
    public static class ArenaDraftRules {
        public static bool Known(string hero)=>hero!=null&&HeroKitCatalog.All.Any(h=>h.Id==hero);
        public static bool ValidTeam(ArenaTeam team)=>team==ArenaTeam.Lux||team==ArenaTeam.Tenebra;
        public static bool Valid(IReadOnlyList<ArenaDraftPick> picks,string luxBan=null,string tenebraBan=null){
            if(picks==null||picks.Count!=10||(luxBan!=null&&!Known(luxBan))||(tenebraBan!=null&&!Known(tenebraBan))||(luxBan!=null&&luxBan==tenebraBan))return false;
            var heroes=new HashSet<string>(StringComparer.Ordinal);var players=new HashSet<string>(StringComparer.Ordinal);
            int lux=0,ten=0;
            foreach(var p in picks){
                if(!ValidTeam(p.Team)||string.IsNullOrWhiteSpace(p.Player)||!Known(p.Hero)||p.Hero==luxBan||p.Hero==tenebraBan||!heroes.Add(p.Hero)||!players.Add(p.Player))return false;
                if(p.Team==ArenaTeam.Lux)lux++;else ten++;
            }
            return lux==5&&ten==5;
        }
        public static string[] PracticeRoster(string playerHero,int seed){
            if(!Known(playerHero))throw new ArgumentException("Unknown hero",nameof(playerHero));
            var pool=HeroKitCatalog.All.Where(h=>h.Id!=playerHero).Select(h=>h.Id).ToList();
            var random=new Random(unchecked(seed*31+911));
            for(int i=pool.Count-1;i>0;i--){int j=random.Next(i+1);string h=pool[i];pool[i]=pool[j];pool[j]=h;}
            return new[]{playerHero}.Concat(pool.Take(9)).ToArray();
        }
        public static bool IsEnemyCounter(string player,string target,IReadOnlyList<ArenaDraftPick> picks){
            if(!Known(target)||picks==null||string.IsNullOrEmpty(player))return false;
            var owners=picks.Where(p=>p.Player==player).ToArray();var foes=picks.Where(p=>p.Hero==target).ToArray();
            return owners.Length==1&&foes.Length==1&&ValidTeam(owners[0].Team)&&ValidTeam(foes[0].Team)&&owners[0].Team!=foes[0].Team;
        }
    }
}
