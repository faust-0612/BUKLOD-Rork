using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ReviewProjectileTests {
        [Test] public void TracerEndpointsMatchConfirmedCoordinates(){
            var a=new Vector3(1,2,3);var b=new Vector3(12,2,8);
            foreach(bool skill in new[]{false,true}){Assert.AreEqual(a,ReviewProjectileEffects.Point(a,b,0,skill));Assert.Less(Vector3.Distance(b,ReviewProjectileEffects.Point(a,b,1,skill)),.00001f);Assert.That(ReviewProjectileEffects.Flight(20,skill),Is.InRange(.055f,.19f));}
        }
        [Test] public void FeedIsBoundedAndRejectsInvalidGeometry(){
            var f=new ReviewProjectileFeed();f.Add("quin",Vector2.zero,Vector2.zero,0,false);Assert.AreEqual(0,f.Sequence);
            for(int i=0;i<30;i++)f.Add("quin",Vector2.zero,Vector2.right,i,false);
            Assert.False(f.TryGet(14,out _));Assert.True(f.TryGet(15,out var row));Assert.AreEqual(Vector2.right,row.To);Assert.AreEqual(30,f.Sequence);
        }
        [Test] public void RejectedAttackDoesNotEmitProjectile(){var b=new OfflineBattle("quin");b.Player.State.Set("blind",1,5,b.Time);Assert.False(b.PlayerAttack(Vector2.zero));Assert.IsNull(b.ProjectileFeed);}
    }
}
