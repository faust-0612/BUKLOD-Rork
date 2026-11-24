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
        [Test] public void CanonicalDamageAndCooldown(){
            var p=new SkillActor("jawo");var w=new World();
            Assert.True(p.TryCast(w,SkillSlot.Primary,Vector2.right,0,true));Assert.AreEqual(118,w.Enemy.Health);
            Assert.AreEqual(.3f,w.Enemy.Buff("slow",1),.0001f);Assert.AreEqual(8,p.Remaining(SkillSlot.Primary,0));
            Assert.AreEqual("ELESUR",HeroKitCatalog.Get("ellusur").Name);
        }
    }
}
