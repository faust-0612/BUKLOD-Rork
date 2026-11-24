using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ArmyStrategyTests {
        [Test] public void FormationOffsetsMirrorFrontAndRear(){
            foreach(ArmyFormation f in System.Enum.GetValues(typeof(ArmyFormation))){
                var front=ArmyStrategyRules.Offset(f,0,false,true);var rear=ArmyStrategyRules.Offset(f,0,true,true);var enemy=ArmyStrategyRules.Offset(f,0,false,false);
                Assert.Greater(front.x,rear.x);Assert.AreEqual(-front.x,enemy.x);Assert.AreEqual(front.y,enemy.y);
            }
            Assert.False(ArmyStrategyRules.Valid((ArmyOrder)999,ArmyFormation.Line,ArenaLane.Mid));
        }
    }
}
