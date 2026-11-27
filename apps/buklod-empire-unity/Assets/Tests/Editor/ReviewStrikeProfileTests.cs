using NUnit.Framework;
using System.Collections.Generic;
namespace Buklod.Empire.Tests {
    public sealed class ReviewStrikeProfileTests {
        [Test] public void CanonicalStrikeProfilesAreDistinctAndBounded(){
            var seen=new HashSet<(float,float,float,float,float)>();
            foreach(var h in HeroKitCatalog.All){var p=ReviewStrikeProfile.For(h.Id);
                Assert.True(seen.Add((p.Arc,p.Reach,p.Lift,p.Width,p.Duration)),h.Id);
                Assert.That(p.Duration,Is.InRange(.15f,.4f));Assert.That(p.Width,Is.InRange(.05f,.2f));
                for(int i=0;i<=16;i++)for(int j=0;j<=10;j++){var v=p.Point(i/16f,j/10f);Assert.That(v.magnitude,Is.LessThan(2.5f));}
            }
            Assert.AreEqual(13,seen.Count);
        }
    }
}
