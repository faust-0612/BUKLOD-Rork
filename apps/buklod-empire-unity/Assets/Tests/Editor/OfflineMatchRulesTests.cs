using NUnit.Framework;
using UnityEngine;
using System.Collections.Generic;
namespace Buklod.Empire.Tests {
public class OfflineMatchRulesTests {
[Test] public void TowerRetaliationAndRampAreBounded(){
Assert.Less(OfflineMatchRules.TowerPriority(BattleTargetKind.Hero,true),OfflineMatchRules.TowerPriority(BattleTargetKind.Minion,false));
Assert.Greater(OfflineMatchRules.TowerPriority(BattleTargetKind.Hero,false),OfflineMatchRules.TowerPriority(BattleTargetKind.Minion,false));
Assert.AreEqual(1f,OfflineMatchRules.TowerRamp(-1));Assert.AreEqual(1.15f,OfflineMatchRules.TowerRamp(1),.0001f);Assert.AreEqual(1.6f,OfflineMatchRules.TowerRamp(999),.0001f);
}
[Test] public void RetreatHysteresis(){Assert.IsTrue(OfflineMatchRules.Retreat(.29f,false));Assert.IsTrue(OfflineMatchRules.Retreat(.77f,true));Assert.IsFalse(OfflineMatchRules.Retreat(.78f,true));}
[Test] public void ProtectedCore(){Assert.IsFalse(OfflineMatchRules.CoreOpen(new[]{true,true,true}));Assert.IsTrue(OfflineMatchRules.CoreOpen(new[]{true,false,true}));}
[Test] public void AimRejectsBehind(){Assert.IsFalse(OfflineMatchRules.InAimCone(Vector2.left,Vector2.right));Assert.IsTrue(OfflineMatchRules.InAimCone(Vector2.right,Vector2.right));}
[Test] public void BuyIsMatchLocalAndNoDuplicate(){var owned=new HashSet<string>();int gold=240;Assert.IsTrue(OfflineMatchRules.TryBuy("blade",owned,ref gold,0,true,true));Assert.IsFalse(OfflineMatchRules.TryBuy("blade",owned,ref gold,0,true,true));Assert.AreEqual(120,gold);}
[Test] public void EquipmentPurchaseAndSaleCannotDuplicateOrProfit(){
var gear=new HashSet<string>();int gold=2000;foreach(var id in new[]{"blade","armor","boots","sealbreaker","withering_thorn","precision"})Assert.True(OfflineMatchRules.TryBuy(id,gear,ref gold,0,true,true));
Assert.False(OfflineMatchRules.TryBuy("wisdom",gear,ref gold,0,true,true));int before=gold;Assert.True(OfflineMatchRules.TrySell("blade",gear,ref gold,0,true,true));Assert.AreEqual(before+72,gold);Assert.False(OfflineMatchRules.TrySell("blade",gear,ref gold,0,true,true));Assert.True(OfflineMatchRules.TryBuy("wisdom",gear,ref gold,0,true,true));
}
[Test] public void BountiesRewardShutdownAndLimitRepeatedDeath(){Assert.AreEqual(75,OfflineMatchRules.KillGold(0,0));Assert.AreEqual(25,OfflineMatchRules.KillGold(99,0));Assert.AreEqual(175,OfflineMatchRules.KillGold(0,99));Assert.AreEqual(7.5f,OfflineMatchRules.RespawnDelay(0));Assert.AreEqual(22.5f,OfflineMatchRules.RespawnDelay(9999));}
[Test] public void TimeLimitCanDraw(){Assert.AreEqual("",OfflineMatchRules.TimeLimitWinner(50,50));}
}
}