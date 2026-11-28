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
            Assert.Less(SculptedRiftLayout.LaneHeight(0,100),41.8f);
            Assert.AreEqual(41.8f,SculptedRiftLayout.LaneHeight(0,35),.001f);
        }
        [Test] public void CurvedApproachNeverReplacesActualCombatTarget(){
            var target=new Vector2(285,41.8f);
            Assert.AreEqual(target,SculptedRiftLayout.LaneWaypoint(0,new Vector2(278,41),true,target));
            var next=SculptedRiftLayout.LaneWaypoint(0,new Vector2(100,30),true,target);
            Assert.Greater(next.x,100);Assert.Less(next.y,41.8f);
        }
    }
}
