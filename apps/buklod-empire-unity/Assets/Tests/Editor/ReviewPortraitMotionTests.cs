using NUnit.Framework;
using System.Collections.Generic;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ReviewPortraitMotionTests {
        [Test] public void AllHeroPortraitsAreDistinctAndLoopSafely(){
            var seen=new HashSet<float>();
            foreach(var h in HeroKitCatalog.All){var p=ReviewPortraitMotion.Get(h.Id);Assert.True(seen.Add(p.Orbit));Assert.That(p.Duration,Is.InRange(.5f,1f));Assert.That(p.Blink,Is.InRange(.3f,.7f));Assert.Less(Vector3.Distance(ReviewPortraitMotion.HeadOffset(h.Id,0),ReviewPortraitMotion.HeadOffset(h.Id,1)),.001f);}
            Assert.AreEqual(13,seen.Count);
        }
    }
}
