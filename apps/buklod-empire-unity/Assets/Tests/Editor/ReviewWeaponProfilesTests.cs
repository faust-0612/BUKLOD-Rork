using System;
using System.Linq;
using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ReviewWeaponProfilesTests {
        [Test] public void EveryCanonicalHeroHasUniqueEquipment(){
            var rows=HeroKitCatalog.All.Select(h=>ReviewWeaponProfiles.Get(h.Id)).ToArray();
            Assert.AreEqual(13,rows.Length);
            Assert.AreEqual(13,rows.Select(x=>x.Equipment).Distinct().Count());
            Assert.AreEqual("mallet",ReviewWeaponProfiles.Get("phan").Equipment);
            Assert.AreEqual("compass",ReviewWeaponProfiles.Get("quin").Equipment);
            Assert.AreEqual("ledger",ReviewWeaponProfiles.Get("angel").Equipment);
            Assert.Throws<ArgumentException>(()=>ReviewWeaponProfiles.Get("unknown"));
        }
        [Test] public void MotionDurationCannotOutlastCombatCadence(){
            foreach(var h in HeroKitCatalog.All){
                Assert.LessOrEqual(ReviewWeaponProfiles.Duration(2,h.BasicCooldown),h.BasicCooldown);
                Assert.AreEqual(.1f,ReviewWeaponProfiles.Duration(.1f,h.BasicCooldown));
            }
            Assert.Throws<ArgumentException>(()=>ReviewWeaponProfiles.Duration(float.NaN,1));
            Assert.Throws<ArgumentException>(()=>ReviewWeaponProfiles.Duration(1,0));
        }
    }
}
