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
    }
}
