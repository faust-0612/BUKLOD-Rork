using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ReviewConfirmedCombatTests {
        [Test] public void ProjectileReceiptsAreBoundedAndRejectInvalidInput(){
            var feed=new ReviewProjectileFeed();
            feed.Add("invalid",Vector2.zero,Vector2.one,0,false);Assert.AreEqual(0,feed.Sequence);
            for(int i=0;i<20;i++)feed.Add("phan",Vector2.zero,Vector2.one,i,false);
            Assert.False(feed.TryGet(4,out _));Assert.True(feed.TryGet(5,out var row));Assert.AreEqual(5,row.Sequence);
            Assert.True(feed.TryGet(20,out row));Assert.AreEqual(19,row.Time);
        }
        [Test] public void PresentationMathIsFiniteAndBounded(){
            Assert.AreEqual(0,ReviewCombatOverlay.Fraction(float.NaN,100));
            Assert.AreEqual(1,ReviewCombatOverlay.Fraction(200,100));
            Assert.AreEqual(0,ReviewCombatOverlay.DamageNumber(-5));
            Assert.AreEqual(99999,ReviewCombatOverlay.DamageNumber(1e8f));
            Assert.AreEqual(Vector3.zero,ReviewProjectileEffects.Point(Vector3.zero,Vector3.one,0,false));
            Assert.LessOrEqual(Vector3.Distance(Vector3.one,ReviewProjectileEffects.Point(Vector3.zero,Vector3.one,1,true)),.00001f);
        }
    }
}
