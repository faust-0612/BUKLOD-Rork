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
[Test] public void TimeLimitCanDraw(){Assert.AreEqual("",OfflineMatchRules.TimeLimitWinner(50,50));}
}
}