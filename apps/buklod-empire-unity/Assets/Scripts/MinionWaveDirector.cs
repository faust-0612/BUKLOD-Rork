using System;
using System.Collections.Generic;

namespace Buklod.Empire {
    // Match-local deterministic port of Claude minion_db.gd and minion_director.gd.
    // No network, persistent economy, Unity scene or visual approval dependencies.
    public enum ArenaTeam { Lux, Tenebra }
    public enum MinionRole { Infantry, Siege, Gunner, Mage, Healer }
    public enum ArenaLane { Top, Mid, Bottom }

    public readonly struct MinionSpawn {
        public readonly ArenaTeam Team;
        public readonly ArenaLane Lane;
        public readonly MinionRole Role;
        public readonly int Wave;
        public readonly double AtSeconds;
        public readonly float Power;
        public MinionSpawn(ArenaTeam team, ArenaLane lane, MinionRole role, int wave, double at, float power) {
            Team=team; Lane=lane; Role=role; Wave=wave; AtSeconds=at; Power=power;
        }
    }

    public sealed class MinionWaveDirector {
        public const double FirstWave=5, Interval=30, MidStart=180, SiegeStart=480, Stagger=.6;
        public const int SiegeEvery=6, SuperWaves=3;
        private readonly int[] superLeft=new int[2];
        private readonly bool[] coreLost=new bool[2];
        private bool ended;
        private readonly float[] research=new float[2];
        private readonly List<MinionSpawn> pending=new List<MinionSpawn>();
        public double Time { get; private set; }
        public int Wave { get; private set; }
        public ArenaTeam? Winner { get; private set; }
        public bool Finished => ended || Time>=OfflineMatchRules.MatchLimit;
        public bool CanReinforce(ArenaTeam team)=>!Finished&&!coreLost[Index(team)];
        public void EndMatch(ArenaTeam? winner){if(ended)return;ended=true;Winner=winner;pending.Clear();}
        private static int Index(ArenaTeam team) {
            if(team!=ArenaTeam.Lux && team!=ArenaTeam.Tenebra) throw new ArgumentOutOfRangeException(nameof(team));
            return (int)team;
        }
        public void SetResearchBonus(ArenaTeam team, float value) {
            if(float.IsNaN(value)||float.IsInfinity(value)||value<0) throw new ArgumentOutOfRangeException(nameof(value));
            research[Index(team)]=value;
        }
        public void TowerDestroyed(ArenaTeam defendingTeam) {
            int i=Index(defendingTeam);
            if(!Finished) superLeft[1-i]=SuperWaves;
        }
        public void CoreDestroyed(ArenaTeam defendingTeam) {
            int i=Index(defendingTeam);
            if(Finished) return;
            coreLost[i]=true;
            pending.RemoveAll(s=>s.Team==defendingTeam);
        }
        public IReadOnlyList<MinionSpawn> Advance(double seconds, int luxTowers, int tenebraTowers) {
            if(double.IsNaN(seconds)||double.IsInfinity(seconds)||seconds<0||luxTowers<0||tenebraTowers<0)
                throw new ArgumentOutOfRangeException(nameof(seconds));
            var due=new List<MinionSpawn>();
            if(Finished) return due;
            double end=Math.Min(Time+seconds, OfflineMatchRules.MatchLimit);
            while(FirstWave+Wave*Interval<=end && FirstWave+Wave*Interval<OfflineMatchRules.MatchLimit) {
                double at=FirstWave+Wave*Interval;
                Wave++;
                bool siege=at>=SiegeStart && Wave%SiegeEvery==0;
                Schedule(ArenaTeam.Lux,at,siege,luxTowers<tenebraTowers);
                Schedule(ArenaTeam.Tenebra,at,siege,tenebraTowers<luxTowers);
            }
            pending.Sort((a,b)=>{
                int c=a.AtSeconds.CompareTo(b.AtSeconds);
                if(c!=0)return c;
                c=a.Team.CompareTo(b.Team); return c!=0?c:a.Lane.CompareTo(b.Lane);
            });
            int n=0;
            while(n<pending.Count && pending[n].AtSeconds<=end) {
                if(pending[n].AtSeconds<OfflineMatchRules.MatchLimit) due.Add(pending[n]);
                n++;
            }
            pending.RemoveRange(0,n);
            Time=end;
            if(Finished) pending.Clear();
            return due;
        }
        private void Schedule(ArenaTeam team,double at,bool siege,bool behind) {
            int i=Index(team);
            if(coreLost[i])return;
            bool super=superLeft[i]>0;
            float power=1f+.04f*(float)(at/60)+research[i]+(super?.25f:0f)+(behind?.10f:0f);
            var roles=new List<MinionRole>{MinionRole.Infantry,MinionRole.Infantry};
            if(super) roles.Add(MinionRole.Infantry);
            if(siege) roles.Add(MinionRole.Siege);
            if(super) roles.Add(MinionRole.Siege);
            roles.Add(MinionRole.Gunner);
            if(at>=MidStart){roles.Add(MinionRole.Mage);roles.Add(MinionRole.Healer);}
            foreach(ArenaLane lane in Enum.GetValues(typeof(ArenaLane)))
                for(int j=0;j<roles.Count;j++)
                    pending.Add(new MinionSpawn(team,lane,roles[j],Wave,at+j*Stagger,power));
            if(super)superLeft[i]--;
        }
    }
}
