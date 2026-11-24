using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
namespace Buklod.Empire {
    public enum WildernessKind { AzureStag, CrimsonWolf, EmeraldSerpent, GoldenScarab, StoneGolem, RiverSpirit, WindFalcon, AncientSentinel, ColossalGuardian }
    public sealed class WildernessCamp {
        public readonly int Id;public readonly WildernessKind Kind;public readonly Vector2 Position;
        public readonly float MaxHealth,Damage,RespawnSeconds;public readonly bool Boss;
        public float Health {get;internal set;}public bool Alive {get;internal set;}
        public float RespawnAt {get;internal set;}public int LastAttackerId {get;internal set;}
        internal float LastHitAt,NextAttackAt;
        public int HitSequence {get;internal set;}
        public int AttackSequence {get;internal set;}
        public int DefeatSequence {get;internal set;}
        public Vector2 LastAttackPosition {get;internal set;}
        internal WildernessCamp(int id,WildernessKind kind,Vector2 p,float hp,float damage,float first,float respawn,bool boss=false){
            Id=id;Kind=kind;Position=p;MaxHealth=hp;Damage=damage;RespawnAt=first;RespawnSeconds=respawn;Boss=boss;
        }
    }
    // Match-local neutral objectives. They never count as a faction unit or revive a defeated faction.
    public sealed class NeutralObjectiveDirector {
        private readonly WildernessCamp[] camps;
        public IReadOnlyList<WildernessCamp> Camps {get;}
        public float Time {get;private set;}
        public NeutralObjectiveDirector(){
            var list=new List<WildernessCamp>();
            var pos=new[]{new Vector2(56,70),new Vector2(78,95),new Vector2(60,145),new Vector2(108,142),new Vector2(115,68),new Vector2(122,172),new Vector2(140,45)};
            for(int i=0;i<pos.Length;i++){
                list.Add(new WildernessCamp(list.Count+1,(WildernessKind)i,pos[i],150+10*i,12+ i,20,60));
                list.Add(new WildernessCamp(list.Count+1,(WildernessKind)i,new Vector2(OfflineBattle.Width-pos[i].x,OfflineBattle.Height-pos[i].y),150+10*i,12+i,20,60));
            }
            list.Add(new WildernessCamp(list.Count+1,WildernessKind.AncientSentinel,new Vector2(160,95),650,25,120,150,true));
            list.Add(new WildernessCamp(list.Count+1,WildernessKind.ColossalGuardian,new Vector2(160,125),1100,35,480,180,true));
            camps=list.ToArray();Camps=Array.AsReadOnly(camps);
        }
        private static bool Finite(float x)=>!float.IsNaN(x)&&!float.IsInfinity(x);
        private static bool Finite(Vector2 p)=>Finite(p.x)&&Finite(p.y);
        public WildernessCamp Find(int id)=>id>0&&id<=camps.Length?camps[id-1]:null;
        public void Advance(float now){
            if(!Finite(now)||now<Time)return;Time=now;
            foreach(var c in camps){
                if(now>=OfflineMatchRules.MatchLimit){c.Alive=false;c.LastAttackerId=0;continue;}
                if(!c.Alive&&now>=c.RespawnAt){c.Alive=true;c.Health=c.MaxHealth;c.LastAttackerId=0;}
                if(c.Alive&&c.LastAttackerId!=0&&now-c.LastHitAt>=7){c.Health=c.MaxHealth;c.LastAttackerId=0;}
            }
        }
        public bool TryHit(int campId,int attackerId,Vector2 origin,float range,float damage,out bool defeated){
            defeated=false;var c=Find(campId);
            if(c==null||!c.Alive||attackerId<=0||!Finite(origin)||!Finite(range)||range<=0||!Finite(damage)||damage<=0||Vector2.Distance(origin,c.Position)>range)return false;
            if(c.LastAttackerId==0)c.NextAttackAt=Time+1.25f;
            c.LastAttackerId=attackerId;c.LastHitAt=Time;c.Health=Mathf.Max(0,c.Health-Mathf.Min(400,damage));c.HitSequence++;
            if(c.Health<=0){c.DefeatSequence++;defeated=true;c.Alive=false;c.LastAttackerId=0;c.RespawnAt=Time+c.RespawnSeconds;}
            return true;
        }
        public bool TryRetaliate(int campId,int attackerId,Vector2 position,out float damage){
            damage=0;var c=Find(campId);
            if(c==null||!c.Alive||c.LastAttackerId!=attackerId||attackerId<=0||!Finite(position)||Time<c.NextAttackAt||Vector2.Distance(position,c.Position)>15)return false;
            c.NextAttackAt=Time+1.25f;c.AttackSequence++;c.LastAttackPosition=position;damage=c.Damage;return true;
        }
    }
}
