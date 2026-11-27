using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ReviewMenuArtTests {
        [Test] public void StageLabelsFollowCanonicalFlow(){
            var stages=new[]{ReviewMatchStage.Mode,ReviewMatchStage.Team,ReviewMatchStage.Hero,ReviewMatchStage.Loadout,ReviewMatchStage.LockIn,ReviewMatchStage.Loading};
            var labels=new[]{"MODE","TEAM","HERO","LOADOUT","LOCK IN","VERSUS"};
            for(int i=0;i<stages.Length;i++){string text=ReviewMenuArt.StepText(stages[i]);StringAssert.Contains("◆ "+labels[i],text);Assert.AreEqual(i,text.Split('✓').Length-1);}
            Assert.AreEqual("",ReviewMenuArt.StepText(ReviewMatchStage.Startup));Assert.AreEqual("",ReviewMenuArt.StepText(ReviewMatchStage.InBattle));
        }
    }
}
