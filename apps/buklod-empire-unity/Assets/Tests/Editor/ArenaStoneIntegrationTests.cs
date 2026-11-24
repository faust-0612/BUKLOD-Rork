using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ArenaStoneIntegrationTests {
        private sealed class World:IHeroSkillWorld {
            public float Distance,Damage,Duration;
            public SkillActor Enemy=new SkillActor("phan");
            public IReadOnlyList<SkillActor> Enemies(SkillActor a,float r,Vector2 aim)=>new[]{Enemy};
            public IReadOnlyList<SkillActor> Allies(SkillActor a,float r)=>new[]{a};
            public bool Hit(SkillActor a,SkillActor b,float d){Damage=d;return true;}
            public bool Dash(SkillActor a,Vector2 d,float n){Distance=n;return true;}
            public bool Wall(SkillActor a,Vector2 d,float n,float r,float t){Duration=t;return true;}
            public bool Turret(SkillActor a,Vector2 d,float n,float h,float t,float damage){Duration=t;return true;}
        }
        [Test] public void QuinCounterReducesActualDashThenExpires(){
            var q=new SkillActor("quin");var w=new World();
            q.Set(ArenaStoneRules.CounterBuff,1,4,0);
            Assert.True(HeroSkillRules.Cast(w,q,"route_dash",Vector2.right,1));
            Assert.AreEqual(4,w.Distance,.0001f);
            Assert.True(HeroSkillRules.Cast(w,q,"route_dash",Vector2.right,4));
            Assert.AreEqual(5,w.Distance,.0001f);
        }
        [Test] public void NielCounterReducesActualBurst(){
            var n=new SkillActor("niel");var w=new World();
            n.Set(ArenaStoneRules.CounterBuff,1,4,0);
            Assert.True(HeroSkillRules.Cast(w,n,"echo_lance",Vector2.right,1));
            Assert.AreEqual(40,w.Damage,.0001f);
        }
        [Test] public void AceCounterReducesActualHealing(){
            var a=new SkillActor("ace"){Health=50};var w=new World();
            a.Set(ArenaStoneRules.CounterBuff,1,4,0);
            Assert.True(HeroSkillRules.Cast(w,a,"field_patch",Vector2.right,1));
            Assert.AreEqual(80.4f,a.Health,.0001f);
        }
        [Test] public void PracticeCounterRejectsWrongTargetWithoutConsuming(){
            var b=new OfflineBattle("phan");
            var ally=b.Units.First(u=>u.Team==b.Player.Team&&u.Kind==BattleTargetKind.Hero);
            var enemy=b.Units.First(u=>u.Team!=b.Player.Team&&u.Kind==BattleTargetKind.Hero);
            Assert.False(b.TryPracticeCounter(ally.State.Kit.Id,ally.Id));
            Assert.False(b.TryPracticeCounter(enemy.State.Kit.Id,enemy.Id));
            Assert.False(b.PracticeCounterUsed);
            Assert.IsNull(b.ActivePracticeCounterTarget);
            Assert.AreEqual(0,b.PracticeCounterRemaining);
        }
    }
}
