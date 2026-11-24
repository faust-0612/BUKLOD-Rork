using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using UnityEngine;
namespace Buklod.Empire {
    [Serializable] public sealed class StoneMission {
        public string heroId,mission,communityEvent,kingdomLocation,kingdomChallenge,locationId,questId;
    }
    // Client display/preflight only. Never grants or consumes an authoritative gem.
    public static class StoneEconomy {
        public const int BPPerStone=100, StonesPerPick=1, StonesPerBan=1, MaxBansPerTeam=1;
        [Serializable] private sealed class Config {
            public int schema,bpPerStone,stonesPerPick,stonesPerBan,maxBansPerTeam;
            public bool freePractice,paidStrengthBonus;
            public StoneMission[] missions;
            public string[] kingdomSources;
        }
        public static IReadOnlyDictionary<string,StoneMission> LoadMissions(){
            var asset=Resources.Load<TextAsset>("StoneEconomy");
            if(asset==null)throw new InvalidOperationException("Stone economy config missing");
            var c=JsonUtility.FromJson<Config>(asset.text);
            if(c==null||c.schema!=1||c.bpPerStone!=BPPerStone||c.stonesPerPick!=StonesPerPick||
                c.stonesPerBan!=StonesPerBan||c.maxBansPerTeam!=MaxBansPerTeam||!c.freePractice||c.paidStrengthBonus||
                c.missions==null||c.missions.Length!=13)throw new InvalidOperationException("Invalid stone policy");
            var map=new Dictionary<string,StoneMission>(StringComparer.Ordinal);
            foreach(var m in c.missions){
                if(m==null||!SacredStoneCatalog.TryGet(m.heroId,out _)||string.IsNullOrWhiteSpace(m.communityEvent)||
                   string.IsNullOrWhiteSpace(m.locationId)||string.IsNullOrWhiteSpace(m.questId)||map.ContainsKey(m.heroId))
                    throw new InvalidOperationException("Invalid mission");
                map.Add(m.heroId,m);
            }
            return new ReadOnlyDictionary<string,StoneMission>(map);
        }
        public static bool CanSelect(string heroId,IReadOnlyDictionary<string,long> balance,bool training,bool banned){
            if(!SacredStoneCatalog.TryGet(heroId,out _)||banned)return false;
            return training||(balance!=null&&balance.TryGetValue(heroId,out long count)&&count>=StonesPerPick);
        }
        public static bool CanBan(string heroId,IReadOnlyDictionary<string,long> balance,int usedTeamBans,bool draftOpen){
            return draftOpen&&usedTeamBans>=0&&usedTeamBans<MaxBansPerTeam&&
                CanSelect(heroId,balance,false,false);
        }
        public static long ExchangeCost(int quantity){
            if(quantity<1||quantity>1000)throw new ArgumentOutOfRangeException(nameof(quantity));
            return (long)quantity*BPPerStone;
        }
    }
}
