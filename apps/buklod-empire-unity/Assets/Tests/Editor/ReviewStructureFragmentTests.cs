using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class ReviewStructureFragmentTests {
        [Test] public void PiecesStartAtRestAndSettle(){
            foreach(int tier in new[]{0,2}){var start=ReviewStructureFragments.Offset(Vector3.right,tier,0,5);Assert.AreEqual(Vector3.zero,start);var end=ReviewStructureFragments.Offset(Vector3.right,tier,1,5);Assert.Less(end.y,0);Assert.Greater(end.x,0);}
        }
        [Test] public void FragmentLifecycleRestoresOriginalRenderer(){
            var root=new GameObject("fixture");try{
                var original=root.AddComponent<MeshRenderer>();var f=root.AddComponent<ReviewStructureFragments>();f.originals=new Renderer[]{original};
                f.pieces=new ReviewStructureFragments.Piece[2];for(int i=0;i<2;i++){var part=new GameObject("part").transform;part.SetParent(root.transform,false);f.pieces[i]=new ReviewStructureFragments.Piece{root=part,origin=Vector3.right*i,direction=Vector3.right,tier=i};}
                Assert.True(f.Begin());Assert.False(original.enabled);f.Apply(.7f,5,1);f.ResetVisual();Assert.True(original.enabled);foreach(var p in f.pieces){Assert.False(p.root.gameObject.activeSelf);Assert.AreEqual(p.origin,p.root.localPosition);}
            }finally{Object.DestroyImmediate(root);}
        }
    }
}
