using System;
using UnityEngine;
namespace Buklod.Empire {
    // Bounded, match-local presentation receipts. Never grants or settles currency.
    public readonly struct ReviewRewardReceipt {
        public readonly int Sequence,Gold,Tier;
        public readonly float Time,Xp,Amount;
        public readonly string Name,Effect;
        internal ReviewRewardReceipt(int sequence,float time,string name,int gold,float xp,string effect,float amount,int tier){
            Sequence=sequence;Time=time;Name=name;Gold=gold;Xp=xp;Effect=effect;Amount=amount;Tier=tier;
        }
        public string Summary {
            get {
                string text=Name??"";
                if(Gold>0)text+="  +"+Gold+" GOLD";
                if(Xp>0)text+="  +"+Xp.ToString("0.#")+" XP";
                if(!string.IsNullOrEmpty(Effect)){
                    if(Effect=="equipped")text+="  EQUIPPED • T"+Tier;
                    else if(Effect=="bought"||Effect=="sold")text+="  "+Effect.ToUpperInvariant();
                    else if(Effect=="used")text+="  USED";
                    else if(Effect=="haste"||Effect=="fury"||Effect=="guard"||Effect=="regen")text+="  "+Effect.ToUpperInvariant()+" BUFF";
                    else if(Amount>0)text+="  +"+Amount.ToString("0.#")+" "+(Effect=="gold"?"VILLAGE GOLD":Effect=="cooldown"?"s COOLDOWN REDUCTION":Effect.ToUpperInvariant());
                }
                return text;
            }
        }
    }
    public sealed class ReviewRewardFeed {
        public const int Capacity=16;
        readonly ReviewRewardReceipt[] rows=new ReviewRewardReceipt[Capacity];
        public int Sequence{get;private set;}
        internal void Add(float time,string name,int gold,float xp,string effect="",float amount=0,int tier=0){
            if(string.IsNullOrEmpty(name)||gold<0||xp<0||amount<0||float.IsNaN(xp)||float.IsInfinity(xp)||float.IsNaN(amount)||float.IsInfinity(amount)||float.IsNaN(time)||float.IsInfinity(time))return;
            int seq=++Sequence;rows[(seq-1)%Capacity]=new ReviewRewardReceipt(seq,time,name,gold,xp,effect,amount,tier);
        }
        public bool TryGet(int sequence,out ReviewRewardReceipt receipt){
            receipt=default;if(sequence<=0||sequence>Sequence||Sequence-sequence>=Capacity)return false;
            receipt=rows[(sequence-1)%Capacity];return receipt.Sequence==sequence;
        }
    }
}
