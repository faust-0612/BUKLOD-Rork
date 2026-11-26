using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public class ArenaTouchLayoutTests {
        [Test] public void SafeAreaOffsetsAreHonored(){
            var area=ArenaTouchLayout.Safe(new Rect(100,20,1800,880),2000,900);
            Assert.That(ArenaTouchLayout.Center(area,new Vector2(.5f,.5f)),Is.EqualTo(new Vector2(1000,460)));
        }
        [Test] public void FloatingStickCannotLeaveSafeArea(){
            var area=new Rect(100,20,1800,880);
            Assert.That(ArenaTouchLayout.ClampCenter(area,area.min,80),Is.EqualTo(new Vector2(180,100)));
            Assert.That(ArenaTouchLayout.Stick(Vector2.zero,80),Is.EqualTo(Vector2.zero));
            Assert.That(ArenaTouchLayout.Stick(new Vector2(200,0),80),Is.EqualTo(Vector2.right));
        }
        [Test] public void NearestActionWins(){
            var area=new Rect(0,0,1600,900);
            var points=new[]{Vector2.zero,new Vector2(.85f,.2f),new Vector2(.8f,.2f)};
            Assert.That(ArenaTouchLayout.Nearest(area,points,ArenaTouchLayout.Center(area,points[2])),Is.EqualTo(2));
        }
    }
}
