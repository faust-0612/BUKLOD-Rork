using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class HeroSkillTests {
        private sealed class World:IHeroSkillWorld {
            public SkillActor Enemy=new SkillActor("phan");
            public bool Allow=true;
            public IReadOnlyList<SkillActor> Enemies(SkillActor a,float r,Vector2 aim)=>Allow?new[]{Enemy}:Array.Empty<SkillActor>();
            public IReadOnlyList<SkillActor> Allies(SkillActor a,float r)=>new[]{a};
            public bool Hit(SkillActor a,SkillActor b,float d){if(!Allow)return false;b.Health=Mathf.Max(0,b.Health-d);return true;}
            public bool Dash(SkillActor a,Vector2 d,float n)=>Allow;
            public bool Wall(SkillActor a,Vector2 d,float n,float r,float t)=>Allow;
            public bool Turret(SkillActor a,Vector2 d,float n,float h,float t,float damage)=>Allow;
        }
        [Test] public void AngelInnateCooldownAndNielResistanceAreBounded(){
            var angel=new SkillActor("angel");Assert.AreEqual(7.2f,angel.Cooldown(SkillSlot.Primary,0),.001f);
            var a=new SkillActor("phan");a.Set("resist",.2f,5,0);a.Set("stun",1,1,0);
            Assert.False(a.CanCast(.79f));Assert.True(a.CanCast(.81f));
            a.Set("suppression",1,2,1);Assert.False(a.CanCast(1.9f));
        }
        [Test] public void AllCanonicalIdentitiesDispatch(){
            Assert.That(HeroKitCatalog.All.Count,Is.EqualTo(13));
            Assert.That(HeroKitCatalog.All.SelectMany(h=>new[]{h.Primary.Id,h.Secondary.Id,h.Ultimate.Id}).Distinct().Count(),Is.EqualTo(39));
            foreach(var h in HeroKitCatalog.All)foreach(SkillSlot slot in Enum.GetValues(typeof(SkillSlot))){
                var a=new SkillActor(h.Id){Level=6};
                Assert.That(a.TryCast(new World(),slot,Vector2.right,0,true),Is.True,h.Id+" "+slot);
            }
        }
        [Test] public void FailedCastDoesNotConsumeManaOrCooldown(){
            var p=new SkillActor("phan");var w=new World{Allow=false};
            Assert.False(p.TryCast(w,SkillSlot.Primary,Vector2.right,0,true));
            Assert.AreEqual(100,p.Mana);Assert.AreEqual(0,p.Remaining(SkillSlot.Primary,0));
            w.Allow=true;Assert.True(p.TryCast(w,SkillSlot.Primary,Vector2.right,0,true));Assert.AreEqual(82,p.Mana);
            Assert.False(p.TryCast(w,SkillSlot.Primary,Vector2.right,1,true));Assert.AreEqual(82,p.Mana);
        }
        [Test] public void UltimateUnlockAndStunAreEnforced(){
            var p=new SkillActor("lhen");var w=new World();
            Assert.False(p.TryCast(w,SkillSlot.Ultimate,Vector2.right,0,true));p.Level=6;p.Set("stun",1,1,0);
            Assert.False(p.TryCast(w,SkillSlot.Ultimate,Vector2.right,.5f,true));
            Assert.True(p.TryCast(w,SkillSlot.Ultimate,Vector2.right,1,true));Assert.AreEqual(45,p.Mana);
        }
        [Test] public void CleanseAndImmunityDoNotRemoveSuppression(){
            var a=new SkillActor("phan");a.Set("root",1,5,0);a.Set("silence",1,5,0);a.Set("disarm",1,5,0);
            Assert.False(a.CanMove(1));Assert.False(a.CanCast(1));Assert.False(a.CanAttack(1));Assert.True(a.Cleanse(1));Assert.True(a.CanMove(1));
            a.Set("ccimmune",1,4,1);a.Set("stun",1,3,1);Assert.True(a.CanCast(2));a.Set("suppression",1,3,1);Assert.False(a.CanCast(2));Assert.False(a.Cleanse(2));Assert.False(a.CanMove(2));Assert.True(a.CanMove(3));
        }
        [Test] public void SameTickSuccessfulCastsRemainDistinct(){
            var p=new SkillActor("phan"){Level=6};var w=new World();
            Assert.True(p.TryCast(w,SkillSlot.Primary,Vector2.right,0,true));
            Assert.True(p.TryCast(w,SkillSlot.Secondary,Vector2.up,0,true));
            Assert.True(p.TryCast(w,SkillSlot.Ultimate,Vector2.left,0,true));
            Assert.AreEqual(3,p.CastSequence);Assert.AreEqual(13,p.Mana);
            for(int i=1;i<=3;i++){Assert.True(p.TryGetCast(i,out var cast));Assert.AreEqual((SkillSlot)(i-1),cast.Slot);}
            Assert.True(p.TryGetCast(2,out var second));Assert.AreEqual(Vector2.up,second.Aim);
            Assert.False(p.TryCast(w,SkillSlot.Primary,Vector2.right,0,true));Assert.AreEqual(3,p.CastSequence);
        }
        [Test] public void CastHistoryIsBoundedAndRejectsStaleReads(){
            var p=new SkillActor("phan");var w=new World();
            for(int i=0;i<10;i++){p.Mana=100;Assert.True(p.TryCast(w,SkillSlot.Secondary,Vector2.right,i*20,true));}
            Assert.AreEqual(10,p.CastSequence);
            Assert.False(p.TryGetCast(1,out _));Assert.False(p.TryGetCast(2,out _));
            Assert.True(p.TryGetCast(3,out _));Assert.True(p.TryGetCast(10,out _));Assert.False(p.TryGetCast(11,out _));
        }
        [Test] public void CanonicalDamageAndCooldown(){
            var p=new SkillActor("jawo");var w=new World();
            Assert.True(p.TryCast(w,SkillSlot.Primary,Vector2.right,0,true));Assert.AreEqual(118,w.Enemy.Health);
            Assert.AreEqual(.3f,w.Enemy.Buff("slow",1),.0001f);Assert.AreEqual(8,p.Remaining(SkillSlot.Primary,0));
            Assert.AreEqual("ELESUR",HeroKitCatalog.Get("ellusur").Name);
        }
    }
}
