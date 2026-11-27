using System;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire {
    // The world adapter must validate alive/team/core protection, navigation and bounded effects.
    public interface IHeroSkillWorld {
        IReadOnlyList<SkillActor> Enemies(SkillActor actor,float radius,Vector2 aim);
        IReadOnlyList<SkillActor> Allies(SkillActor actor,float radius);
        bool Hit(SkillActor actor,SkillActor target,float damage);
        bool Dash(SkillActor actor,Vector2 direction,float distance);
        bool Wall(SkillActor actor,Vector2 direction,float distance,float radius,float duration);
        bool Turret(SkillActor actor,Vector2 direction,float distance,float health,float duration,float damage);
    }
    public readonly struct SkillCastEvent {
        public readonly int Sequence; public readonly SkillSlot Slot; public readonly Vector2 Aim;
        public SkillCastEvent(int sequence,SkillSlot slot,Vector2 aim){Sequence=sequence;Slot=slot;Aim=aim;}
    }
    public sealed class SkillActor {
        public readonly HeroKit Kit;
        public float Health=160, MaxHealth=160, Mana=100, MaxMana=100, Shield;
        internal float ShieldCapacity=105;
        internal float Clock,EquipmentCooldown,TalentCooldown,TalentRecovery;
        internal int HarmonyStacks,TriageSequence;
        private float temporaryShield,temporaryShieldUntil;
        public int Level=3;
        public float LastCastAt {get;private set;}=float.NegativeInfinity;
        public SkillSlot LastCastSlot {get;private set;}
        public Vector2 LastCastAim {get;private set;}
        public const int CastHistoryCapacity=8;
        private readonly SkillCastEvent[] castHistory;
        public int CastSequence {get;private set;}
        public bool TryGetCast(int sequence,out SkillCastEvent cast){
            cast=default;
            if(castHistory==null||sequence<=0||sequence>CastSequence||CastSequence-sequence>=CastHistoryCapacity)return false;
            cast=castHistory[(sequence-1)%CastHistoryCapacity];return cast.Sequence==sequence;
        }
        public bool Alive=>Health>0;
        private readonly Dictionary<string,(float strength,float until)> buffs=new Dictionary<string,(float,float)>();
        private readonly float[] last={float.NegativeInfinity,float.NegativeInfinity,float.NegativeInfinity};
        public SkillActor(string hero){Kit=HeroKitCatalog.Get(hero);castHistory=new SkillCastEvent[CastHistoryCapacity];}
        internal SkillActor(float health){Health=MaxHealth=health;Mana=0;Level=0;}
        internal void Respawn(){Health=MaxHealth;Mana=MaxMana;Shield=0;temporaryShield=temporaryShieldUntil=0;buffs.Clear();}
        public float Buff(string id,float now){
            float basic=buffs.TryGetValue(id,out var b)&&b.until>now?b.strength:0;
            return buffs.TryGetValue("field:"+id,out var f)&&f.until>now?Mathf.Max(basic,f.strength):basic;
        }
        internal bool ExtendPickupBuff(string id,float value,float duration,float now){
            if(duration<=0||value<=0)return false;string key="field:"+id;
            bool active=buffs.TryGetValue(key,out var old)&&old.until>now;
            float end=Mathf.Min(now+60,(active?old.until:now)+duration),strength=active?Mathf.Max(old.strength,value):value;
            if(active&&end<=old.until&&strength<=old.strength)return false;buffs[key]=(strength,end);return true;
        }
        public void Clear(string id)=>buffs.Remove(id);
        private static readonly string[] Cleanseable={"stun","slow","root","silence","disarm","blind","fear"};
        public bool CanMove(float now)=>Alive&&Buff("stun",now)<=0&&Buff("root",now)<=0&&Buff("suppression",now)<=0&&Buff("fear",now)<=0;
        public bool CanCast(float now)=>Alive&&Buff("stun",now)<=0&&Buff("silence",now)<=0&&Buff("suppression",now)<=0&&Buff("fear",now)<=0;
        public bool CanAttack(float now)=>Alive&&Buff("stun",now)<=0&&Buff("disarm",now)<=0&&Buff("suppression",now)<=0&&Buff("fear",now)<=0;
        public bool Cleanse(float now){bool changed=false;foreach(string id in Cleanseable){if(Buff(id,now)>0)changed=true;Clear(id);}return changed;}
        public void Set(string id,float strength,float until,float now){
            if(string.IsNullOrEmpty(id)||float.IsNaN(strength)||float.IsInfinity(strength)||float.IsNaN(until)||float.IsInfinity(until)||until<=now||strength<=0)return;
            if(Buff("ccimmune",now)>0&&Array.IndexOf(Cleanseable,id)>=0)return;
            if(buffs.TryGetValue(id,out var b)&&b.until>now){strength=Mathf.Max(strength,b.strength);until=Mathf.Max(until,b.until);}
            buffs[id]=(strength,until);
        }
        public void Heal(float value){if(Alive&&!float.IsNaN(value)&&!float.IsInfinity(value))Health=Mathf.Min(MaxHealth,Health+Mathf.Max(0,value)*(1+TalentRecovery)*(1-Mathf.Clamp(Buff("antiheal",Clock),0,.5f)));}
        public void AddShield(float value,float cap=105){if(!Alive)return;if(temporaryShieldUntil<=Clock)temporaryShield=0;
            float limit=Mathf.Min(ShieldCapacity,cap+ShieldCapacity-105);Shield+=Mathf.Max(0,Mathf.Min(value,limit-Shield-temporaryShield));}
        internal float AddTemporaryShield(float value,float until,float now){
            if(!Alive)return 0;if(temporaryShieldUntil<=now)temporaryShield=0;
            float before=temporaryShield;temporaryShield=Mathf.Min(Mathf.Max(0,ShieldCapacity-Shield),temporaryShield+Mathf.Max(0,value));
            if(temporaryShield>before)temporaryShieldUntil=Mathf.Max(temporaryShieldUntil,until);return Mathf.Max(0,temporaryShield-before);
        }
        internal float Absorb(float incoming,float now){
            if(temporaryShieldUntil<=now)temporaryShield=0;
            float t=Mathf.Min(temporaryShield,incoming);temporaryShield-=t;incoming-=t;
            float s=Mathf.Min(Shield,incoming);Shield-=s;return incoming-s;
        }
        internal float PickupShield(float value,float now){
            if(temporaryShieldUntil<=now)temporaryShield=0;
            float gain=Mathf.Max(0,Mathf.Min(value,ShieldCapacity-Shield-temporaryShield));if(Alive)Shield+=gain;else gain=0;return gain;
        }
        internal float ReduceActiveCooldowns(float seconds,float now){
            if(!Alive||Kit==null||seconds<=0)return 0;float total=0;
            for(int i=0;i<3;i++){float n=Mathf.Min(seconds,Remaining((SkillSlot)i,now));if(n>0){last[i]-=n;total+=n;}}return total;
        }
        public float Cooldown(SkillSlot slot,float now){
            var v=Kit.Skill(slot).Cooldown*(1-Mathf.Clamp(Buff("cooldown",now)+EquipmentCooldown+TalentCooldown,0,.35f));
            if(Kit.Id=="angel")v*=.9f;
            if(Kit.Id=="trudice")v*=1-.05f*Mathf.Clamp(Buff("insight",now),0,3);
            return v;
        }
        public float Remaining(SkillSlot slot,float now)=>Mathf.Max(0,Cooldown(slot,now)-(now-last[(int)slot]));
        public static float ManaCost(SkillSlot slot)=>slot==SkillSlot.Primary?18:slot==SkillSlot.Secondary?14:slot==SkillSlot.Ultimate?55:float.PositiveInfinity;
        public bool CanAttemptCast(SkillSlot slot,float now){
            if(!Alive||Kit==null||float.IsNaN(now)||float.IsInfinity(now)||now<0||!CanCast(now))return false;
            if(slot!=SkillSlot.Primary&&slot!=SkillSlot.Secondary&&slot!=SkillSlot.Ultimate)return false;
            if(slot==SkillSlot.Secondary&&Level<3||slot==SkillSlot.Ultimate&&Level<6)return false;
            return Mana>=ManaCost(slot)&&Remaining(slot,now)<=0;
        }
        public bool TryCast(IHeroSkillWorld world,SkillSlot slot,Vector2 aim,float now,bool active){
            if(!active||world==null||!CanAttemptCast(slot,now))return false;
            if(float.IsNaN(aim.x)||float.IsInfinity(aim.x)||float.IsNaN(aim.y)||float.IsInfinity(aim.y))return false;
            float cost=ManaCost(slot);
            if(!HeroSkillRules.Cast(world,this,Kit.Skill(slot).Id,aim,now))return false;
            Mana-=cost;last[(int)slot]=now;LastCastAt=now;LastCastSlot=slot;LastCastAim=aim;
            CastSequence++;if(Kit.Skill(slot).Id=="checkmate_rescue")TriageSequence=CastSequence;castHistory[(CastSequence-1)%CastHistoryCapacity]=new SkillCastEvent(CastSequence,slot,aim);
            foreach(var e in world.Enemies(this,17.5f,Vector2.zero)){
                if(e.Kit?.Id!="trudice")continue;
                e.Set("insight",Mathf.Min(3,e.Buff("insight",now)+1),now+6,now);Set("revealed",1,now+2,now);
            }
            return true;
        }
    }
    public static class HeroSkillRules {
        public static bool Cast(IHeroSkillWorld w,SkillActor p,string id,Vector2 aim,float now){
            Vector2 dir=aim.sqrMagnitude>.0025f?aim.normalized:Vector2.right;
            float Scale(string category)=>ArenaStoneRules.Scale(p,category,now);
            void Buff(SkillActor a,string key,float value,float seconds){
                if(key=="haste")value*=Scale("mobility")*Scale("rally")*Scale("support");
                if(key=="guard")value*=Scale("rally")*Scale("shield")*Scale("support");
                if(key=="regen")value*=Scale("support")*Scale("heal");
                if(key=="cooldown")value*=Scale("support");
                if(key=="stun"||key=="slow"||key=="weaken")seconds*=Scale("control");
                a.Set(key,value,now+seconds,now);
            }
            void Allies(float r,string key,float value,float seconds){foreach(var a in w.Allies(p,r))Buff(a,key,value,seconds);}
            void Enemies(float r,string key,float value,float seconds){foreach(var a in w.Enemies(p,r,Vector2.zero))Buff(a,key,value,seconds);}
            float HealScale()=>p.Kit.Id=="lhen"?1+.08f*p.HarmonyStacks:1;
            void Heal(float r,float amount,float shield=0){foreach(var a in w.Allies(p,r)){a.Heal(amount*HealScale()*Scale("heal")*Scale("support"));if(shield>0)a.AddShield(shield*Scale("shield")*Scale("support"));}if(p.Kit.Id=="lhen")p.HarmonyStacks=Math.Min(5,p.HarmonyStacks+1);}
            bool Area(float r,float damage,float slow=0){bool any=false;foreach(var e in w.Enemies(p,r,Vector2.zero)){if(!w.Hit(p,e,damage*Scale("burst")))continue;any=true;if(slow>0)Buff(e,"slow",slow,3);}return any;}
            SkillActor Nearest(float r,bool directional=false){var es=w.Enemies(p,r,directional?aim:Vector2.zero);return es.Count>0?es[0]:null;}
            bool Hit(float r,float damage,bool directional=false,string effect=null,float value=0,float seconds=0){var e=Nearest(r,directional);if(e==null||!w.Hit(p,e,damage*Scale("burst")))return false;if(effect!=null)Buff(e,effect,value,seconds);return true;}
            bool Wounded(float r,bool shield){SkillActor best=null;foreach(var a in w.Allies(p,r))if(best==null||a.Health/a.MaxHealth<best.Health/best.MaxHealth)best=a;if(best==null)return false;if(shield)best.AddShield(35*Scale("shield"));else{best.Heal(38*HealScale()*Scale("heal"));if(p.Kit.Id=="lhen")p.HarmonyStacks=Math.Min(5,p.HarmonyStacks+1);}return true;}
            bool Dash(float distance,float damage=0,float radius=0,float slow=0){if(!w.Dash(p,dir,distance*Scale("mobility")))return false;if(damage>0)Area(radius,damage,slow);return true;}
            switch(id){
                case "foundation_wall":case "mosaic_wall":return w.Wall(p,dir,4,2.2f,5*Scale("barrier")*Scale("construct"));
                case "route_dash":case "intercept_rush":case "knight_step":return Dash(5);
                case "banner_rush":return Dash(5,28,3.3f);
                case "groundbreaker":return Area(6,31);
                case "resonance_wave":Area(6,20);Heal(7,21);return true;
                case "bayanihan_bastion":case "stand_united":case "command_network":foreach(var a in w.Allies(p,10)){a.AddShield(36*Scale("barrier")*Scale("shield")*Scale("rally"),90);Buff(a,"guard",.2f,8);}return true;
                case "horizon_corridor":case "rally_formation":case "symphony_of_buklod":Allies(12,"haste",.2f,8);if(id=="symphony_of_buklod")Heal(12,48);return true;
                case "beacon_mark":var marked=Nearest(12,true);if(marked==null)return false;Buff(marked,"marked",.15f,5);return true;
                case "signal_shield":return Wounded(9,true);
                case "restorative_beat":case "field_patch":return Wounded(9,false);
                case "checkmate_rescue":Buff(p,"triage",1,10);return true;
                case "vine_riff":return Area(7.5f,42,.30f);
                case "echo_skip":return Dash(5.5f,22,3.5f,.35f);
                case "canopy_crescendo":Area(9.5f,48,.35f);Allies(9.5f,"haste",.12f,5);Allies(9.5f,"fury",.15f,5);return true;
                case "pigment_bolt":return Hit(13,49,true,"weaken",.15f,3);
                case "living_canvas":Heal(9.5f,42);Allies(9.5f,"guard",.1f,8);Allies(9.5f,"regen",4,8);Enemies(9.5f,"slow",.3f,6);return true;
                case "echo_lance":return Hit(12,50,true);
                case "conviction_dash":if(!Dash(5.5f,46,3.25f))return false;Buff(p,"guard",.25f,3);return true;
                case "call_of_the_dawn":Area(14,49);foreach(var a in w.Allies(p,10)){a.Clear("slow");a.Clear("stun");}return true;
                case "question_sigil":var t=Nearest(11,true);if(t==null||!w.Hit(p,t,18))return false;float resist=0;foreach(var a in w.Allies(t,8.75f))if(a.Kit?.Id=="niel")resist=.2f;Buff(t,"stun",1,1-resist);return true;
                case "turning_page":Buff(p,"guard",.4f,3);Buff(p,"reflect",.3f,3);return true;
                case "grand_lesson":Allies(11,"guard",.1f,8);Allies(11,"cooldown",.2f,8);Enemies(11,"weaken",.15f,8);return true;
                case "seed_turret":return w.Turret(p,dir,3,55*1.35f,8*Scale("construct"),11);
                case "irrigation_snare":Enemies(6,"slow",.4f,6);return true;
                case "harvest_engine":if(!w.Turret(p,dir,3,150*1.35f,10*Scale("construct"),16))return false;Allies(9,"guard",.2f,8);Enemies(9,"slow",.35f,8);return true;
                case "ledger_shield":foreach(var a in w.Allies(p,10.5f))a.AddShield(a.MaxHealth*.25f*1.25f*Scale("shield"));return true;
                case "balance_field":Allies(6.5f,"guard",.15f,5);return true;
                case "equal_measure":foreach(var a in w.Allies(p,15)){a.AddShield(a.MaxHealth*(.10f+(1-a.Health/Mathf.Max(1,a.MaxHealth))*.16f)*Scale("shield"));Buff(a,"guard",.2f,8);}return true;
                case "guiding_path":Allies(9.5f,"haste",.3f,4);return true;
                case "seed_sanctuary":Heal(5.5f,34);Allies(5.5f,"regen",3,6);foreach(var a in w.Allies(p,5.5f))a.Clear("slow");return true;
                case "beacon_of_service":Heal(10.5f,54,25);Allies(10.5f,"haste",.25f,8);Allies(10.5f,"guard",.15f,8);Allies(10.5f,"regen",3.5f,8);return true;
                default:return false;
            }
        }
    }
}
