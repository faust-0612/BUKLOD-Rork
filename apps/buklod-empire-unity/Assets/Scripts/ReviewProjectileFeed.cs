using UnityEngine;
namespace Buklod.Empire {
    // Offline visual receipts only. Damage is already resolved by the canonical combat rules.
    public readonly struct ReviewProjectileReceipt {
        public readonly int Sequence;
        public readonly string Hero;
        public readonly Vector2 From,To;
        public readonly float Time;
        public readonly bool Skill;
        internal ReviewProjectileReceipt(int sequence,string hero,Vector2 from,Vector2 to,float time,bool skill){Sequence=sequence;Hero=hero;From=from;To=to;Time=time;Skill=skill;}
    }
    public sealed class ReviewProjectileFeed {
        public const int Capacity=16;
        readonly ReviewProjectileReceipt[] rows=new ReviewProjectileReceipt[Capacity];
        public int Sequence{get;private set;}
        internal void Add(string hero,Vector2 from,Vector2 to,float time,bool skill){
            if(!ArenaDraftRules.Known(hero)||!Finite(from)||!Finite(to)||float.IsNaN(time)||float.IsInfinity(time)||(to-from).sqrMagnitude<.0025f)return;
            int sequence=++Sequence;rows[(sequence-1)%Capacity]=new ReviewProjectileReceipt(sequence,hero,from,to,time,skill);
        }
        static bool Finite(Vector2 p)=>!float.IsNaN(p.x)&&!float.IsInfinity(p.x)&&!float.IsNaN(p.y)&&!float.IsInfinity(p.y);
        public bool TryGet(int sequence,out ReviewProjectileReceipt row){
            row=default;if(sequence<=0||sequence>Sequence||Sequence-sequence>=Capacity)return false;
            row=rows[(sequence-1)%Capacity];return row.Sequence==sequence;
        }
    }
}
