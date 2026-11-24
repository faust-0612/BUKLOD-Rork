using System.Linq;
using NUnit.Framework;
using UnityEngine;
namespace Buklod.Empire.Tests {
    public sealed class AuthoritativeMatchTests {
        static ArenaDraftPick[] Draft()=>HeroKitCatalog.All.Take(10).Select((h,i)=>new ArenaDraftPick("player"+i,h.Id,i<5?ArenaTeam.Lux:ArenaTeam.Tenebra)).ToArray();
        sealed class Fixture {
            public readonly AuthoritativeMatch Match=new AuthoritativeMatch(Draft(),71);
            public readonly MatchSession[] Sessions=new MatchSession[10];
            public Fixture(){for(int i=0;i<10;i++){Sessions[i]=Match.OpenSession("player"+i);Assert.NotNull(Sessions[i]);}}
            public MatchSnapshot Snapshot(string player)=>Match.Snapshot(Session(player));
            public bool Submit(string player,MatchInput frame)=>Match.Submit(Session(player),frame);
            public bool AdvanceTick()=>Match.AdvanceTick();
            public MatchSession Session(string player)=>player.StartsWith("player")&&int.TryParse(player.Substring(6),out int i)&&i>=0&&i<10?Sessions[i]:null;
        }
        static Fixture Match()=>new Fixture();
        static MatchUnitSnapshot Own(MatchSnapshot s)=>s.Units.Single(u=>u.Id==s.OwnUnitId);
        [Test] public void TenUniqueSlotsAndHiddenEnemies(){
            var m=Match();var ids=Enumerable.Range(0,10).Select(i=>m.Snapshot("player"+i).OwnUnitId).ToArray();
            Assert.AreEqual(10,ids.Distinct().Count());Assert.IsNull(m.Snapshot("unknown"));
            Assert.False(m.Snapshot("player0").Units.Any(u=>u.Team==ArenaTeam.Tenebra));
            Assert.False(m.Snapshot("player0").Resources.Any(n=>n.Team==ArenaTeam.Tenebra));
            Assert.AreEqual(5,m.Snapshot("player0").TeamBalances.Count);
            Assert.True(m.Snapshot("player0").IsRtsController);Assert.False(m.Snapshot("player1").IsRtsController);
        }
        [Test] public void BothFactionsMoveIndependentlyAndOtherHumansDoNotBot(){
            var m=Match();var a=Own(m.Snapshot("player0")).Position;var b=Own(m.Snapshot("player5")).Position;var idle=Own(m.Snapshot("player1")).Position;
            Assert.True(m.Submit("player0",new MatchInput(1,1,Vector2.right)));
            Assert.True(m.Submit("player5",new MatchInput(1,1,Vector2.left)));
            Assert.True(m.AdvanceTick());
            Assert.Greater(Own(m.Snapshot("player0")).Position.x,a.x);Assert.Less(Own(m.Snapshot("player5")).Position.x,b.x);
            Assert.AreEqual(idle,Own(m.Snapshot("player1")).Position);
        }
        [Test] public void DuplicateFutureAndMalformedInputsFailClosed(){
            var m=Match();Assert.False(m.Submit("unknown",new MatchInput(1,1,Vector2.zero)));
            Assert.False(m.Submit("player0",new MatchInput(1,2,Vector2.zero)));
            Assert.False(m.Submit("player0",new MatchInput(1,1,new Vector2(float.NaN,0))));
            Assert.False(m.Submit("player0",new MatchInput(1,1,Vector2.right*2)));
            Assert.True(m.Submit("player0",new MatchInput(1,1,Vector2.right)));
            Assert.False(m.Submit("player0",new MatchInput(2,1,Vector2.left)));m.AdvanceTick();
            Assert.False(m.Submit("player0",new MatchInput(1,2,Vector2.zero)));
            Assert.AreEqual(1,m.Snapshot("player0").AppliedSequence);
        }
        [Test] public void DisconnectClearsPendingAndDoesNotResetReplaySequence(){
            var m=Match();var start=Own(m.Snapshot("player0")).Position;
            Assert.True(m.Submit("player0",new MatchInput(1,1,Vector2.right)));
            var old=m.Sessions[0];Assert.True(m.Match.CloseSession(old));Assert.IsNull(m.Snapshot("player0"));m.AdvanceTick();
            m.Sessions[0]=m.Match.OpenSession("player0");Assert.NotNull(m.Sessions[0]);Assert.False(m.Match.Submit(old,new MatchInput(2,2,Vector2.right)));Assert.False(m.Match.CloseSession(old));Assert.AreEqual(start,Own(m.Snapshot("player0")).Position);
            Assert.False(m.Submit("player0",new MatchInput(1,2,Vector2.right)));
            Assert.True(m.Submit("player0",new MatchInput(2,2,Vector2.right)));m.AdvanceTick();
            m.AdvanceTick();m.AdvanceTick();var at=Own(m.Snapshot("player0")).Position;m.AdvanceTick();Assert.AreEqual(at,Own(m.Snapshot("player0")).Position);
        }
        [Test] public void TrustedSlotCannotSpendAnotherHeroesGoldOrIssueUnauthorizedTeamOrder(){
            var m=Match();int before=m.Snapshot("player0").Gold;
            Assert.True(m.Submit("player1",new MatchInput(1,1,Vector2.zero,MatchAction.WorkerOrder,target:(int)VillageWorkerOrder.Hold,text:"lira")));
            Assert.True(m.Submit("player5",new MatchInput(1,1,Vector2.zero,MatchAction.WorkerOrder,target:(int)VillageWorkerOrder.Hold,text:"lira")));
            m.AdvanceTick();Assert.False(m.Snapshot("player1").LastActionSucceeded);Assert.False(m.Snapshot("player5").LastActionSucceeded);
            Assert.AreEqual(before,m.Snapshot("player0").Gold);
        }
        [Test] public void ReplaySameOrderedInputsProducesSameSnapshots(){
            var a=Match();var b=Match();
            for(int t=1;t<=30;t++){
                for(int i=0;i<10;i++){var frame=new MatchInput(t,t,i<5?Vector2.right:Vector2.left);Assert.True(a.Submit("player"+i,frame));Assert.True(b.Submit("player"+i,frame));}
                a.AdvanceTick();b.AdvanceTick();
            }
            var x=a.Snapshot("player0");var y=b.Snapshot("player0");
            CollectionAssert.AreEqual(x.Units.Select(u=>u.Id),y.Units.Select(u=>u.Id));
            CollectionAssert.AreEqual(x.Units.Select(u=>u.Position),y.Units.Select(u=>u.Position));
            CollectionAssert.AreEqual(x.Units.Select(u=>u.Health),y.Units.Select(u=>u.Health));
        }
    }
}
