using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class OnlineControlRoutingTests {
        static OnlineUnit Unit(int id,ArenaTeam team,BattleTargetKind kind,Vector2 p,bool alive=true)=>new OnlineUnit{Id=id,Team=team,Kind=kind,Position=p,Flags=(ushort)(alive?1:0)};
        static OnlineSnapshot Snapshot()=>new OnlineSnapshot{OwnUnitId=1,Team=ArenaTeam.Lux,Units=new[]{
            Unit(1,ArenaTeam.Lux,BattleTargetKind.Hero,Vector2.zero),
            Unit(2,ArenaTeam.Lux,BattleTargetKind.Minion,Vector2.right),
            Unit(3,ArenaTeam.Tenebra,BattleTargetKind.Minion,Vector2.right*2,false),
            Unit(4,ArenaTeam.Tenebra,BattleTargetKind.Minion,Vector2.right*3),
            Unit(5,ArenaTeam.Tenebra,BattleTargetKind.Structure,Vector2.up*4),
            Unit(6,ArenaTeam.Tenebra,BattleTargetKind.Minion,Vector2.left)
        }};
        [TestCase(1,MatchAction.Attack,0)]
        [TestCase(2,MatchAction.Cast,0)]
        [TestCase(3,MatchAction.Cast,1)]
        [TestCase(4,MatchAction.Cast,2)]
        [TestCase(5,MatchAction.Tactic,0)]
        [TestCase(6,MatchAction.Recall,0)]
        public void StandardControls(int button,MatchAction expected,int slot){
            Assert.IsTrue(OnlineControlRouting.TryRoute(Snapshot(),button,Vector2.zero,out var action,out int target));
            Assert.AreEqual(expected,action);Assert.AreEqual(slot,target);
            Assert.IsTrue(new MatchInput(1,1,Vector2.zero,action,Vector2.zero,target).Valid());
        }
        [Test] public void TargetControlsUseOnlyVisibleLivingEnemyOfRequestedKind(){
            var s=Snapshot();
            Assert.IsTrue(OnlineControlRouting.TryRoute(s,7,Vector2.right,out var a,out int id));Assert.AreEqual(MatchAction.AttackUnit,a);Assert.AreEqual(4,id);
            Assert.IsTrue(OnlineControlRouting.TryRoute(s,8,Vector2.zero,out a,out id));Assert.AreEqual(5,id);
            Assert.IsFalse(OnlineControlRouting.TryRoute(s,8,Vector2.down,out a,out id));
            Assert.IsTrue(OnlineControlRouting.TryRoute(s,7,Vector2.zero,out a,out id));Assert.AreEqual(6,id);
        }
        [Test] public void FinishedMissingOrDeadPlayerCannotIssueInput(){
            Assert.IsFalse(OnlineControlRouting.TryRoute(null,1,Vector2.zero,out _,out _));
            var s=Snapshot();s.Finished=true;Assert.IsFalse(OnlineControlRouting.TryRoute(s,1,Vector2.zero,out _,out _));
            s.Finished=false;s.Units[0].Flags=0;Assert.IsFalse(OnlineControlRouting.TryRoute(s,1,Vector2.zero,out _,out _));
        }
        [Test] public void CameraRelativeMovementIsBounded(){
            var v=OnlineControlRouting.ToWorld(new Vector2(1,1),Vector3.forward,Vector3.left);
            Assert.LessOrEqual(v.magnitude,1.0001f);Assert.Less(v.x,0);Assert.Greater(v.y,0);
        }
    }
}
