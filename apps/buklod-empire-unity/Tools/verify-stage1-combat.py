#!/usr/bin/env python3
"""Fail closed on absent, skipped, failed, inconclusive or incomplete Unity tests."""
import json, pathlib, sys, xml.etree.ElementTree as ET
REQUIRED={
    "EditMode": (
        "EveryHeroCanDamageAnEnemyAndAnEnemyTowerWithTouchIntent",
        "TapApproachesOnceThenStopsAndManualMovementCancels",
        "MinionTargetButtonIgnoresCloserEnemyHero",
        "RejectedSkillExplainsLevelManaAndTargetWithoutSpending",
        "ProtectedCoreAndNoNearbyTargetDoNotSpendCooldown",
        "EnemyTowerActuallyDamagesNearbyHeroAndRecordsTarget",
        "OffCenterTouchWithoutDragHasNoDirectionalAim",
        "HeroSkillTests.AllCanonicalIdentitiesDispatch",
        "OfflineMatchRulesTests.",
        "LocalPracticeStoreTests.",
    ),
    "PlayMode": (
        "ActualReviewSceneStartsAndAttacksWithEveryHero",
        "EveryHeroStartsAnIndependentOfflineMatch",
        "AutonomousEarlyMatchMaintainsBoundedEconomyAndUnits",
    ),
}
def validate(platform, path):
    p=pathlib.Path(path)
    if platform not in REQUIRED or not p.is_file() or p.stat().st_size>32*1024*1024:
        raise ValueError("Invalid or missing Unity test result")
    root=ET.parse(p).getroot()
    rows=list(root.iter("test-case"))
    if root.tag!="test-run" or root.get("result")!="Passed" or not rows or any(r.get("result")!="Passed" for r in rows):
        raise ValueError("Unity test run incomplete or failed")
    counts={k:int(root.get(k,"-1")) for k in ("total","passed","failed","skipped","inconclusive")}
    if counts["total"]!=len(rows) or counts["passed"]!=len(rows) or any(counts[k]!=0 for k in ("failed","skipped","inconclusive")):
        raise ValueError("Inconsistent Unity test counts")
    names=[r.get("fullname","") for r in rows]
    missing=[n for n in REQUIRED[platform] if not any(n in s for s in names)]
    if missing: raise ValueError("Missing mandatory tests: "+", ".join(missing))
    return counts
if __name__=="__main__":
    print(json.dumps(validate(sys.argv[1],sys.argv[2]),sort_keys=True))
