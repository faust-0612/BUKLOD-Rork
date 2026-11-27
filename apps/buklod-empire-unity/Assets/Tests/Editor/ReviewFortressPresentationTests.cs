using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ReviewFortressPresentationTests {
        [Test] public void CollapseStartsAtOriginalTransformAndEndsBelowGround(){
            foreach(bool core in new[]{false,true}){
                var first=ReviewFortressCollapse.Evaluate(0,5,42,core);
                Assert.AreEqual(Vector3.zero,first.Offset);Assert.AreEqual(Vector3.zero,first.Tilt);Assert.AreEqual(Vector3.one,first.Scale);
                var final=ReviewFortressCollapse.Evaluate(1,5,42,core);
                Assert.Less(final.Offset.y,0);Assert.Less(final.Scale.y,.1f);
                for(int i=0;i<=100;i++){var p=ReviewFortressCollapse.Evaluate(i/100f,5,42,core);Assert.Greater(p.Scale.y,0);Assert.LessOrEqual(p.Scale.y,1);}
            }
        }
        [Test] public void TerrainAudioIsContinuousAndBounded(){
            var left=ReviewRiftAtmosphere.At(49.999f,100);var right=ReviewRiftAtmosphere.At(50.001f,100);
            Assert.Less(Mathf.Abs(left.Gain-right.Gain),.001f);
            Assert.Less(Mathf.Abs(left.Cutoff-right.Cutoff),1);
            for(int i=0;i<=100;i++){var z=ReviewRiftAtmosphere.At(i,100);Assert.That(z.Gain,Is.InRange(.8f,1.2f));Assert.That(z.Cutoff,Is.InRange(7000,18000));}
        }
    }
}
