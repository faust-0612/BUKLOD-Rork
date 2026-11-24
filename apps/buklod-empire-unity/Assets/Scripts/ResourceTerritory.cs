using System;
using UnityEngine;
namespace Buklod.Empire {
    // Only the simulation advances control; no passive income or capture payout.
    public sealed class ResourceTerritory {
        public const float Radius=9,CaptureSeconds=8,LockSeconds=12;
        public readonly int Id;
        public readonly string Name;
        public readonly Vector2 Position;
        public ArenaTeam? Owner {get;private set;}
        public ArenaTeam? Challenger {get;private set;}
        public float Progress {get;private set;}
        public float LockedUntil {get;private set;}
        public bool Contested {get;private set;}
        internal ResourceTerritory(int id,string name,Vector2 position){Id=id;Name=name;Position=position;}
        internal void Advance(float now,float dt,bool luxHero,bool tenHero,bool luxPresent,bool tenPresent){
            if(float.IsNaN(now)||float.IsInfinity(now)||float.IsNaN(dt)||float.IsInfinity(dt)||dt<=0||dt>1||now>=OfflineMatchRules.MatchLimit)return;
            Contested=luxPresent&&tenPresent;
            if(now<LockedUntil)return;
            ArenaTeam? next=!Contested&&luxHero&&!tenPresent?ArenaTeam.Lux:!Contested&&tenHero&&!luxPresent?ArenaTeam.Tenebra:(ArenaTeam?)null;
            if(!next.HasValue||next==Owner){
                Progress=Mathf.Max(0,Progress-dt*2);if(Progress<=0)Challenger=null;return;
            }
            if(Challenger!=next){Challenger=next;Progress=0;}
            Progress=Mathf.Min(CaptureSeconds,Progress+dt);
            if(Progress+.0001f<CaptureSeconds)return;
            Owner=next;Challenger=null;Progress=0;LockedUntil=now+LockSeconds;
        }
    }
}
