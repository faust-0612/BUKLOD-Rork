using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public class ArenaPickupTests {
        [Test] public void CanonicalCatalogHas300UniqueMatchOnlyDefinitions(){
            var a=ArenaPickupCatalog.All;Assert.AreEqual(300,a.Count);Assert.AreEqual(300,a.Select(x=>x.Id).Distinct().Count());
            Assert.AreEqual(144,a.Count(x=>x.Hero==null));Assert.AreEqual(156,a.Count(x=>x.Hero!=null));
            foreach(var h in HeroKitCatalog.All)Assert.AreEqual(12,a.Count(x=>x.Hero==h.Id));
            Assert.True(ArenaPickupCatalog.TryGet("h-quin-1-t3",out var item));Assert.AreEqual("quin",item.Hero);Assert.AreEqual(9,item.MinLevel);
        }
        [Test] public void HeroKillsCreateDeterministicDropsAndCannotDuplicate(){
            var a=new OfflineBattle("phan",seed:13);var b=new OfflineBattle("phan",seed:13);
            foreach(var m in new[]{a,b}){var e=m.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);Assert.True(m.Hit(m.Player.State,e.State,300));Assert.False(m.Hit(m.Player.State,e.State,300));Assert.AreEqual(1,m.Drops.Count);Assert.False(m.CollectPlayerPickup(m.Drops[0].Id));}
            Assert.AreEqual(a.Drops[0].Item.Id,b.Drops[0].Item.Id);
        }
        [Test] public void MatchRestartClearsGroundLoot(){
            var a=new OfflineBattle("phan");var e=a.Units.First(u=>u.Team==ArenaTeam.Tenebra&&u.Kind==BattleTargetKind.Hero);a.Hit(a.Player.State,e.State,300);
            Assert.AreEqual(1,a.Drops.Count);Assert.IsEmpty(new OfflineBattle("phan").Drops);
        }
    }
}
