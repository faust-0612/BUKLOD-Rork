using NUnit.Framework;
namespace Buklod.Empire.Tests {
    public sealed class ReviewRewardReceiptTests {
        [Test] public void SuccessfulShopActionsProduceOnlyConfirmedLocalReceipts(){
            var b=new OfflineBattle("phan");
            Assert.False(b.BuyPlayer("unknown"));Assert.AreEqual(0,b.RewardFeed.Sequence);
            Assert.True(b.BuyPlayer("blade"));Assert.True(b.RewardFeed.TryGet(1,out var buy));Assert.AreEqual("bought",buy.Effect);
            Assert.False(b.BuyPlayer("blade"));Assert.AreEqual(1,b.RewardFeed.Sequence);
            Assert.True(b.SellPlayer("blade"));Assert.True(b.RewardFeed.TryGet(2,out var sell));Assert.AreEqual("sold",sell.Effect);
        }
        [Test] public void NeutralRewardSummaryReportsMatchLocalGoldAndXp(){
            var f=new ReviewRewardFeed();f.Add(5,"TEAM BOSS BONUS",35,45);
            Assert.True(f.TryGet(1,out var receipt));StringAssert.Contains("+35 GOLD",receipt.Summary);StringAssert.Contains("+45 XP",receipt.Summary);
        }
        [Test] public void BusyHudConsumesRetainedReceiptsInOrderAfterOverflow(){
            var feed=new ReviewRewardFeed();
            for(int i=1;i<=20;i++)feed.Add(0,"REWARD",i,0);
            int cursor=0;
            for(int expected=5;expected<=20;expected++){
                Assert.True(feed.TryReadNext(ref cursor,out var receipt));
                Assert.AreEqual(expected,receipt.Sequence);
                Assert.AreEqual(expected,receipt.Gold);
            }
            Assert.False(feed.TryReadNext(ref cursor,out _));
            feed.Add(1,"NEW REWARD",21,0);
            Assert.True(feed.TryReadNext(ref cursor,out var latest));
            Assert.AreEqual(21,latest.Sequence);
        }
        [Test] public void FeedRejectsInvalidValuesAndRetainsBoundedHistory(){
            var f=new ReviewRewardFeed();f.Add(0,"invalid",-1,0);f.Add(0,"invalid",0,float.NaN);
            Assert.AreEqual(0,f.Sequence);
            for(int i=0;i<20;i++)f.Add(i,"ASSIST",1,0);
            Assert.False(f.TryGet(4,out _));Assert.True(f.TryGet(5,out var row));Assert.AreEqual(1,row.Gold);
        }
    }
}
