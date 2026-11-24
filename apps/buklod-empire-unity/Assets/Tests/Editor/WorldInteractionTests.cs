using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class WorldInteractionTests {
        [Test] public void AllFragmentsRemainFiniteAndBounded(){
            foreach(WorldImpactKind kind in System.Enum.GetValues(typeof(WorldImpactKind))){
                Assert.Greater(WorldImpactMotion.Duration(kind),0);
                for(int i=0;i<WorldImpactMotion.Fragments;i++)for(int frame=0;frame<=20;frame++){
                    float t=frame/20f;var a=WorldImpactMotion.Evaluate(kind,17,i,t);var b=WorldImpactMotion.Evaluate(kind,17,i,t);
                    Assert.AreEqual(a.Position,b.Position);Assert.AreEqual(a.Rotation,b.Rotation);Assert.AreEqual(a.Size,b.Size);
                    Assert.IsFalse(float.IsNaN(a.Position.sqrMagnitude)||float.IsInfinity(a.Position.sqrMagnitude));
                    Assert.Less(a.Position.magnitude,5);Assert.GreaterOrEqual(a.Position.y,0);Assert.That(a.Size,Is.InRange(0f,.5f));
                    if(frame==20)Assert.AreEqual(0,a.Size,.0001f);
                }
            }
        }
        [Test] public void PoolBudgetIsFixed(){
            Assert.AreEqual(12,WorldInteractionEffects.Capacity);Assert.AreEqual(16,WorldImpactMotion.Fragments);
        }
    }
}
