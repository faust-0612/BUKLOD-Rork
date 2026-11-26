using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public class StylizedArenaPresentationTests {
        [Test] public void CameraLooksAtAnchor(){
            var forward=StylizedArenaPresentation.CameraRotation*Vector3.forward;
            Assert.That(Vector3.Dot(forward,-StylizedArenaPresentation.CameraOffset.normalized),Is.GreaterThan(.999f));
            Assert.That(StylizedArenaPresentation.CameraOffset.y,Is.GreaterThan(0));
        }
        [Test] public void FollowIsFrameRateIndependent(){
            float a=StylizedArenaPresentation.FollowWeight(.1f),b=StylizedArenaPresentation.FollowWeight(.05f);
            Assert.That(a,Is.EqualTo(1-(1-b)*(1-b)).Within(.00001f));
        }
        [Test] public void GroundSpeedIgnoresHeightAndBoundsSpikes(){
            Assert.That(StylizedArenaPresentation.Speed(Vector3.zero,new Vector3(.5f,9,0),.1f),Is.EqualTo(5f).Within(.001f));
            Assert.That(StylizedArenaPresentation.Speed(Vector3.zero,Vector3.one,0),Is.Zero);
            Assert.That(StylizedArenaPresentation.Speed(Vector3.zero,Vector3.one,.00001f),Is.EqualTo(12f));
        }
    }
}
