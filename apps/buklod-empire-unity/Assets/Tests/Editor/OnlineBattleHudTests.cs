using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class OnlineBattleHudTests {
        [Test] public void ResultRequiresAuthoritativeFinishedSnapshot(){
            Assert.AreEqual("MATCH RESULT UNAVAILABLE",OnlineBattleHud.Status(OnlineConnectionState.Finished,null));
            var s=new OnlineSnapshot{Team=ArenaTeam.Lux,Winner=ArenaTeam.Lux};
            Assert.AreEqual("MATCH RESULT UNAVAILABLE",OnlineBattleHud.Status(OnlineConnectionState.Finished,s));
            s.Finished=true;Assert.AreEqual("VICTORY",OnlineBattleHud.Status(OnlineConnectionState.Finished,s));
            s.Winner=ArenaTeam.Tenebra;Assert.AreEqual("DEFEAT",OnlineBattleHud.Status(OnlineConnectionState.Finished,s));
            s.Winner=null;Assert.AreEqual("DRAW",OnlineBattleHud.Status(OnlineConnectionState.Finished,s));
            Assert.AreEqual("RECONNECTING • INPUT PAUSED",OnlineBattleHud.Status(OnlineConnectionState.Reconnecting,s));
        }
        [Test] public void OwnUnitMustMatchSnapshotIdentityAndTeam(){
            var s=new OnlineSnapshot{OwnUnitId=1,Team=ArenaTeam.Lux,Units=new[]{
                new OnlineUnit{Id=1,Team=ArenaTeam.Tenebra,Kind=BattleTargetKind.Hero,Flags=1},
                new OnlineUnit{Id=2,Team=ArenaTeam.Lux,Kind=BattleTargetKind.Hero,Flags=1}
            }};
            Assert.IsNull(OnlineBattleHud.Own(s));
            s.Units[0].Team=ArenaTeam.Lux;Assert.AreSame(s.Units[0],OnlineBattleHud.Own(s));
        }
        [Test] public void CooldownsReadServerValuesOnly(){
            var s=new OnlineSnapshot{SkillRemaining=new[]{0f,1.2f,40f},TacticRemaining=3.5f};
            Assert.AreEqual("",OnlineBattleHud.Cooldown(s,2));Assert.AreEqual("2",OnlineBattleHud.Cooldown(s,3));
            Assert.AreEqual("40",OnlineBattleHud.Cooldown(s,4));Assert.AreEqual("4",OnlineBattleHud.Cooldown(s,5));
            Assert.AreEqual("",OnlineBattleHud.Cooldown(s,1));s.Finished=true;Assert.AreEqual("",OnlineBattleHud.Cooldown(s,4));
        }
    }
}
