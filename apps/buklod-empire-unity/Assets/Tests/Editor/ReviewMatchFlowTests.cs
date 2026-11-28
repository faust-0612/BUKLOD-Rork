using NUnit.Framework;
using System.Linq;
namespace Buklod.Empire.Tests {
    public sealed class ReviewMatchFlowTests {
        [Test] public void RequiresBootAndEveryPreparationStage(){
            var f=new ReviewMatchFlow();
            Assert.False(f.Begin());Assert.False(f.Advance());Assert.True(f.BootReady());Assert.True(f.Begin());
            foreach(var expected in new[]{ReviewMatchStage.Difficulty,ReviewMatchStage.Team,ReviewMatchStage.Hero,ReviewMatchStage.Loadout,ReviewMatchStage.LockIn,ReviewMatchStage.Loading}){
                Assert.True(f.Advance());Assert.AreEqual(expected,f.Stage);
            }
            Assert.False(f.Advance());Assert.False(f.Back());Assert.False(f.ResumeBattle());Assert.True(f.CompleteLoading());
            Assert.AreEqual(ReviewMatchStage.InBattle,f.Stage);
        }
        [Test] public void BackAndFailureNeverStartMatch(){
            var f=new ReviewMatchFlow();f.BootReady();f.Begin();Assert.True(f.Back());Assert.AreEqual(ReviewMatchStage.Lobby,f.Stage);
            f.Begin();for(int i=0;i<6;i++)f.Advance();Assert.True(f.FailLoading());Assert.AreEqual(ReviewMatchStage.LockIn,f.Stage);
            Assert.True(f.Back());Assert.AreEqual(ReviewMatchStage.Loadout,f.Stage);
        }
        [Test] public void StartupAtlasReadsFramesInRowMajorOrder(){
            var first=OfflineSessionMenu.StartupFrame(0);
            var nextRow=OfflineSessionMenu.StartupFrame(4);
            var last=OfflineSessionMenu.StartupFrame(12);
            Assert.AreEqual(2f/3f,first.y);
            Assert.AreEqual(1f/3f,nextRow.y);
            Assert.AreEqual(.75f,last.x);
            Assert.AreEqual(0,last.y);
        }
        [Test] public void AllHeroesUseSameDeterministicRosterAsBattle(){
            foreach(var h in HeroKitCatalog.All){
                var a=ArenaDraftRules.PracticeRoster(h.Id,42);
                Assert.AreEqual(10,a.Length);Assert.AreEqual(10,a.Distinct().Count());Assert.AreEqual(h.Id,a[0]);
                CollectionAssert.AreEqual(a,ArenaDraftRules.PracticeRoster(h.Id,42));
            }
        }
    }
}
