using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class SculptedRiftTests {
        [Test] public void IslandRejectsSquareCornersAndPreservesAnchors(){
            foreach(var p in new[]{new Vector2(2,2),new Vector2(318,2),new Vector2(2,218),new Vector2(318,218)})Assert.IsFalse(SculptedRiftLayout.Contains(p,1));
            foreach(float x in new[]{14f,17f,19f,35f,285f,301f,303f,306f}){
                Assert.IsTrue(SculptedRiftLayout.Contains(new Vector2(x,110),1));
                if(x>=19&&x<=301)foreach(float y in new[]{41.8f,178.2f})Assert.IsTrue(SculptedRiftLayout.Contains(new Vector2(x,y),1));
            }
            foreach(var c in new NeutralObjectiveDirector().Camps)Assert.IsTrue(SculptedRiftLayout.Contains(c.Position,1));
        }
        [Test] public void ThreeCurvedLanesAndRiverHaveHalfTurnSymmetry(){
            for(int i=0;i<=80;i++){
                var a=SculptedRiftLayout.LanePoint(0,i,80);var b=SculptedRiftLayout.LanePoint(2,80-i,80);
                Assert.Less((a+b-new Vector2(320,220)).magnitude,.001f);
                foreach(int lane in new[]{0,1,2})Assert.IsTrue(SculptedRiftLayout.Contains(SculptedRiftLayout.LanePoint(lane,i,80),4));
                float z=220*i/80f;Assert.AreEqual(320,SculptedRiftLayout.RiverX(z)+SculptedRiftLayout.RiverX(220-z),.001f);
            }
            for(int lane=0;lane<3;lane++){
                var crossing=SculptedRiftLayout.Crossing(lane);
                Assert.AreEqual(SculptedRiftLayout.RiverX(crossing.y),crossing.x,.01f);
                for(int i=0;i<=200;i++){
                    var p=SculptedRiftLayout.LanePoint(lane,i,200);
                    for(int j=0;j<SculptedRiftLayout.CoverCount;j++){
                        var cover=SculptedRiftLayout.Cover(j);
                        Assert.Greater(Vector2.Distance(p,new Vector2(cover.x*320,cover.y*220))-cover.z*220,4.2f,"Lane intersects solid cover");
                    }
                }
            }
            Assert.Less(SculptedRiftLayout.LaneHeight(0,100),41.8f);
            Assert.AreEqual(41.8f,SculptedRiftLayout.LaneHeight(0,35),.001f);
        }
        [Test] public void PhysicalRiverbedAndCausewaysUseSameLayout(){
            for(int lane=0;lane<3;lane++)Assert.AreEqual(0,SculptedRiftLayout.GroundElevation(SculptedRiftLayout.Crossing(lane)),.001f);
            Assert.Less(SculptedRiftLayout.GroundElevation(new Vector2(SculptedRiftLayout.RiverX(75),75)),-.35f);
            for(int i=0;i<4;i++){
                var c=SculptedRiftLayout.BrushCenter(i);
                Assert.AreEqual(i,SculptedRiftLayout.BrushAt(c));
                Assert.AreEqual(-1,SculptedRiftLayout.BrushAt(c+Vector2.right*(SculptedRiftLayout.BrushRadius(i)+.2f)));
            }
        }
        [Test] public void CurvedApproachNeverReplacesActualCombatTarget(){
            var target=new Vector2(285,41.8f);
            Assert.AreEqual(target,SculptedRiftLayout.LaneWaypoint(0,new Vector2(278,41),true,target));
            var next=SculptedRiftLayout.LaneWaypoint(0,new Vector2(100,30),true,target);
            Assert.Greater(next.x,100);Assert.Less(next.y,41.8f);
        }
    }
}
