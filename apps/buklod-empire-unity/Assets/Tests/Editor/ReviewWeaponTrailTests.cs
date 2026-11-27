using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ReviewWeaponTrailTests {
        [Test] public void EquipmentAnchorsAreFiniteAndBounded(){
            foreach(var h in HeroKitCatalog.All){var p=ReviewWeaponTrail.FallbackAnchor(h.Id);Assert.True(ReviewWeaponTrail.Finite(p));Assert.That(p.magnitude,Is.InRange(.05f,1f));}
            Assert.AreEqual(16,ReviewWeaponTrail.Samples);
        }
        [Test] public void AnchorFollowsTheActualHandTransform(){
            var root=new GameObject("hero");try{var hand=new GameObject("Hand_R").transform;hand.SetParent(root.transform,false);
                var trail=root.AddComponent<ReviewWeaponTrail>();var anchor=ReviewWeaponTrail.FallbackAnchor("phan");trail.Configure(hand,anchor,false);
                var first=trail.Hand.TransformPoint(trail.Anchor);hand.localRotation=Quaternion.Euler(0,0,90);
                Assert.Greater(Vector3.Distance(first,trail.Hand.TransformPoint(trail.Anchor)),.1f);
            }finally{Object.DestroyImmediate(root);}
        }
    }
}
