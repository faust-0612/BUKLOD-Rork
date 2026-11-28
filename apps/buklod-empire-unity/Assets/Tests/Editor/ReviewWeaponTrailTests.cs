using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ReviewWeaponTrailTests {
        [Test] public void EquipmentAnchorsAreFiniteAndBounded(){
            foreach(var h in HeroKitCatalog.All){var p=ReviewWeaponTrail.FallbackAnchor(h.Id);Assert.True(ReviewWeaponTrail.Finite(p));Assert.That(p.magnitude,Is.InRange(.05f,1f));}
            Assert.AreEqual(16,ReviewWeaponTrail.Samples);
        }
        [Test] public void ActualImportedHandAliasesAndRibbonFade(){
            Assert.IsTrue(ReviewWeaponTrail.IsRightHand("mixamorig:RightHand"));
            Assert.IsTrue(ReviewWeaponTrail.IsRightHand("mixamorig_RightHand"));
            Assert.IsTrue(ReviewWeaponTrail.IsRightHand("Hand_R"));
            Assert.IsFalse(ReviewWeaponTrail.IsRightHand("mixamorig:LeftHand"));
            Assert.AreEqual(0,ReviewWeaponTrail.Fade(0));Assert.AreEqual(.25f,ReviewWeaponTrail.Fade(.5f));Assert.AreEqual(1,ReviewWeaponTrail.Fade(1));
            var root=new GameObject("actual candidate");try{
                var hand=new GameObject("mixamorig:RightHand").transform;hand.SetParent(root.transform,false);
                var component=root.AddComponent<ReviewWeaponTrail>();component.Configure(hand,new Vector3(.08f,.02f,0),true);
                Assert.IsTrue(component.GeometryDerived);
            }finally{Object.DestroyImmediate(root);}
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
