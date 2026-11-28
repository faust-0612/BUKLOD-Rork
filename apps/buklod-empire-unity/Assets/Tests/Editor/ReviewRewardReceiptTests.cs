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
        [Test] public void FeedRejectsInvalidValuesAndRetainsBoundedHistory(){
            var f=new ReviewRewardFeed();f.Add(0,"invalid",-1,0);f.Add(0,"invalid",0,float.NaN);
            Assert.AreEqual(0,f.Sequence);
            for(int i=0;i<20;i++)f.Add(i,"ASSIST",1,0);
            Assert.False(f.TryGet(4,out _));Assert.True(f.TryGet(5,out var row));Assert.AreEqual(1,row.Gold);
        }
    }
}
