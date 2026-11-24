using System;
using System.Linq;
using NUnit.Framework;

namespace Buklod.Empire.Tests {
    public class MinionWaveDirectorTests {
        [Test] public void FirstWaveStaggersAcrossBothFactionsAndThreeLanes() {
            var d=new MinionWaveDirector();
            Assert.That(d.Advance(4.99,3,3),Is.Empty);
            Assert.That(d.Advance(.02,3,3).Count,Is.EqualTo(6));
            var later=d.Advance(1.3,3,3);
            Assert.That(later.Count,Is.EqualTo(12));
            Assert.That(later.Count(x=>x.Role==MinionRole.Gunner),Is.EqualTo(6));
            Assert.That(d.Advance(0,3,3),Is.Empty);
        }
        [Test] public void MidWaveAddsMageAndHealerAndSiegeBeginsAtWave18() {
            var d=new MinionWaveDirector();
            var all=d.Advance(520,3,3);
            Assert.That(all.Count(x=>x.Wave==7),Is.EqualTo(30));
            Assert.That(all.Where(x=>x.Role==MinionRole.Siege).Select(x=>x.Wave).Distinct().Single(),Is.EqualTo(18));
            Assert.That(all.Count(x=>x.Wave==18&&x.Role==MinionRole.Siege),Is.EqualTo(6));
        }
        [Test] public void TowerLossBuffsAttackerForExactlyThreeWavesAndDefenderGetsComeback() {
            var d=new MinionWaveDirector();
            d.TowerDestroyed(ArenaTeam.Tenebra);
            var all=d.Advance(100,3,2);
            Assert.That(all.Count(x=>x.Team==ArenaTeam.Lux&&x.Role==MinionRole.Siege),Is.EqualTo(9));
            Assert.That(all.Count(x=>x.Team==ArenaTeam.Lux&&x.Wave==4&&x.Role==MinionRole.Siege),Is.Zero);
            Assert.That(all.First(x=>x.Team==ArenaTeam.Tenebra).Power,Is.EqualTo(1+.04*5/60+.10).Within(.0001));
        }
        [Test] public void MatchEndCancelsDelayedSpawns() {
            var d=new MinionWaveDirector();
            d.Advance(5,3,3);
            d.CoreDestroyed(ArenaTeam.Tenebra);
            Assert.That(d.Winner,Is.Null);
            Assert.That(d.Advance(1.3,3,3).All(x=>x.Team==ArenaTeam.Lux),Is.True);
            d.EndMatch(ArenaTeam.Lux);
            Assert.That(d.Advance(900,3,3),Is.Empty);
            d.CoreDestroyed(ArenaTeam.Lux);
            Assert.That(d.Winner,Is.EqualTo(ArenaTeam.Lux));
        }
        [Test] public void TimeLimitAndInvalidInputFailClosed() {
            var d=new MinionWaveDirector();
            Assert.Throws<ArgumentOutOfRangeException>(()=>d.Advance(double.NaN,3,3));
            Assert.That(d.Advance(10000,3,3).All(x=>x.AtSeconds<900),Is.True);
            Assert.That(d.Time,Is.EqualTo(900));
            Assert.That(d.Advance(30,3,3),Is.Empty);
        }
    }
}
