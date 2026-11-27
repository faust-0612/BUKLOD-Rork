using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ReviewRewardFeedTests {
        [Test] public void ReceiptsAreBoundedAndSequenceChecked(){
            var f=new ReviewRewardFeed();for(int i=0;i<40;i++)f.Add(i,"MINION",22,16);
            Assert.AreEqual(40,f.Sequence);Assert.False(f.TryGet(24,out _));Assert.True(f.TryGet(25,out var r));Assert.AreEqual(25,r.Sequence);Assert.AreEqual(22,r.Gold);Assert.AreEqual(16,r.Xp);Assert.False(f.TryGet(41,out _));
        }
        [Test] public void VillageGoldIsNotHeroGold(){
            var f=new ReviewRewardFeed();f.Add(1,"Cache",0,0,"gold",30);Assert.True(f.TryGet(1,out var r));StringAssert.Contains("30 VILLAGE GOLD",r.Summary);Assert.AreEqual(0,r.Gold);
        }
        [Test] public void InvalidReceiptIsIgnored(){var f=new ReviewRewardFeed();f.Add(0,"Bad",0,float.NaN);Assert.AreEqual(0,f.Sequence);}
        [Test] public void PassiveIncomeDoesNotProduceAnEarnedReceipt(){var b=new OfflineBattle("phan");b.Advance(.1f,UnityEngine.Vector2.zero);Assert.IsNull(b.RewardFeed);}
    }
}
