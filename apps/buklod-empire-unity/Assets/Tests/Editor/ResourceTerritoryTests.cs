using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ResourceTerritoryTests {
        [Test] public void CaptureRequiresHeroAndUncontestedPresenceAndHasLock(){
            var t=new ResourceTerritory(1,"Mine",Vector2.zero);
            for(int i=1;i<=16;i++)t.Advance(i*.5f,.5f,false,false,true,false);
            Assert.IsNull(t.Owner);
            for(int i=17;i<=32;i++)t.Advance(i*.5f,.5f,true,false,true,true);
            Assert.IsNull(t.Owner);Assert.True(t.Contested);
            for(int i=33;i<=48;i++)t.Advance(i*.5f,.5f,true,false,true,false);
            Assert.AreEqual(ArenaTeam.Lux,t.Owner);
            for(int i=49;i<=64;i++)t.Advance(i*.5f,.5f,false,true,false,true);
            Assert.AreEqual(ArenaTeam.Lux,t.Owner);
            for(int i=73;i<=88;i++)t.Advance(i*.5f,.5f,false,true,false,true);
            Assert.AreEqual(ArenaTeam.Tenebra,t.Owner);
        }
        [Test] public void InterruptedCaptureDecaysAndCutoffFreezesOwnership(){
            var t=new ResourceTerritory(1,"Mine",Vector2.zero);
            t.Advance(1,1,true,false,true,false);Assert.AreEqual(1,t.Progress);
            t.Advance(2,1,false,false,false,false);Assert.AreEqual(0,t.Progress);
            t.Advance(900,1,true,false,true,false);Assert.IsNull(t.Owner);Assert.AreEqual(0,t.Progress);
        }
    }
}
