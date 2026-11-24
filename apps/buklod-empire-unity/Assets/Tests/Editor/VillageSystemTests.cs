using System;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;

namespace Buklod.Empire.Tests {
    public class VillageSystemTests {
        private sealed class Battle : IVillageBattle {
            public bool Accept=true;
            public int TowerLevel=1, DeployCount, Revived, Heals;
            public readonly List<VillageItem> Items=new List<VillageItem>();
            public int LowestTowerLevel(ArenaTeam team)=>TowerLevel;
            public bool UpgradeTower(ArenaTeam team,int level,float hp,float dmg) {
                if(!Accept)return false;
                TowerLevel++;return true;
            }
            public bool Deploy(ArenaTeam team,ArenaLane lane,int count,float power) {
                if(!Accept)return false;
                DeployCount+=count;return true;
            }
            public bool HealNearBase(ArenaTeam team,float amount,float radius){Heals++;return Accept;}
            public bool GiveItem(ArenaTeam team,VillageItem item,float power){Items.Add(item);return Accept;}
            public bool CraftAtFront(ArenaTeam team,VillageItem item){if(!Accept)return false;Items.Add(item);return true;}
            public int ReviveRecent(ArenaTeam team,int count,float seconds,float hp)=>Revived;
        }
        [Test] public void CanonicalRosterHasTwelveDistinctIds() {
            var w=new MinionWaveDirector();var b=new Battle();
            var l=new VillageSystem(ArenaTeam.Lux,w,b);
            var t=new VillageSystem(ArenaTeam.Tenebra,w,b);
            CollectionAssert.AreEqual(new[]{"aron","lira","daren","serah","kiel","miko"},l.Members.Select(m=>m.Job.Id));
            CollectionAssert.AreEqual(new[]{"rogar","velin","kael","mora","zed","taro"},t.Members.Select(m=>m.Job.Id));
        }
        [Test] public void GatheringRespectsFactionRateAndFourActionsPerLevel() {
            var w=new MinionWaveDirector();var b=new Battle{Accept=false};
            var l=new VillageSystem(ArenaTeam.Lux,w,b);
            var t=new VillageSystem(ArenaTeam.Tenebra,w,b);
            l.Advance(20);t.Advance(20);
            Assert.That(l.Wood,Is.EqualTo(24).Within(.001));
            Assert.That(t.Wood,Is.EqualTo(33.6).Within(.001));
            Assert.That(l.Find("lira").Level,Is.EqualTo(2));
        }
        [Test] public void DownedGathererDoesNotWorkAndRespawnsAtHalfHealth() {
            var w=new MinionWaveDirector();var b=new Battle{Accept=false};
            var l=new VillageSystem(ArenaTeam.Lux,w,b);
            var m=l.Find("lira");m.Damage(200);
            l.Advance(5);Assert.That(l.Wood,Is.Zero);
            l.Advance(15);Assert.That(l.Wood,Is.Zero);
            l.Advance(40);Assert.That(m.Alive,Is.True);Assert.That(m.Health,Is.EqualTo(100));
        }
        [Test] public void CoreLossPreventsWorkerRespawn(){
            var w=new MinionWaveDirector();var v=new VillageSystem(ArenaTeam.Lux,w,new Battle{Accept=false});
            w.CoreDestroyed(ArenaTeam.Lux);v.Find("lira").Damage(200);v.Advance(90);
            Assert.False(v.Find("lira").Alive);Assert.That(v.Wood,Is.Zero);
        }
        [Test] public void FailedSceneOperationsDoNotSpendResources() {
            var w=new MinionWaveDirector();
            var a=new VillageSystem(ArenaTeam.Lux,w,new Battle{Accept=false});
            var b=new VillageSystem(ArenaTeam.Lux,new MinionWaveDirector(),new Battle());
            a.Advance(90);b.Advance(90);
            Assert.That(a.TowersUpgraded,Is.Zero);
            Assert.That(b.TowersUpgraded,Is.GreaterThan(0));
            Assert.That(a.Wood,Is.GreaterThan(b.Wood));
        }
        [Test] public void ResearchFeedsWavePowerAndCapsAtFive() {
            var w=new MinionWaveDirector();var v=new VillageSystem(ArenaTeam.Lux,w,new Battle());
            v.Advance(300);
            Assert.That(v.ResearchTier,Is.InRange(1,5));
            var first=w.Advance(5,3,3).First(s=>s.Team==ArenaTeam.Lux);
            Assert.That(first.Power,Is.EqualTo(1+.04*5/60+.04*v.ResearchTier).Within(.001));
        }
        [Test] public void ScavengerOnlyCreditsWhileAliveAndStopsAtMatchEnd() {
            var w=new MinionWaveDirector();var v=new VillageSystem(ArenaTeam.Tenebra,w,new Battle());
            v.EnemyDefeated(true);v.Advance(6);
            Assert.That(v.Wood,Is.EqualTo(28.4).Within(.001));
            v.Find("taro").Damage(200);v.EnemyDefeated(true);
            v.Advance(6);Assert.That(v.Wood,Is.EqualTo(36.8).Within(.001));
            w.EndMatch(ArenaTeam.Tenebra);
            var before=v.Wood;v.Advance(100);Assert.That(v.Wood,Is.EqualTo(before));
            Assert.Throws<ArgumentOutOfRangeException>(()=>v.Advance(double.NaN));
        }
    }
}
