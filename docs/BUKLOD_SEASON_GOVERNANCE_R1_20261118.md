# BUKLOD Season 2 Governance Contract R1

DEV-only code contract, based on the currently staged Season2 story-preview branch. No Season1 production change or Season2 reward launch.

## Permanent rules
- Keep lifetime Circle Rank, earned Character XP/levels per Character, owned items, and permanent badges during season rollover.
- Archive signed competitive seasonal results once, reset only season score, preserve independent monthly rank.
- Preserve QMP, AdMob revenue, withdrawals, earned financial amounts and historical Season1 records. Seasonal wallet/event token expiry must be pre-disclosed, never retroactive.
- BUKLOD Character remains sole canonical XP/item/badge entitlement owner. Kingdom uses verified receipts.
- Offer voluntary Faith, non-Faith, solo, creator and community progression paths, accessible catch-up and one genuinely new storyline, collectibles, fair contest and finale every season.
- Make anti-farming, server authority, idempotency, RLS, immutable history and rollovers mandatory.

## Conflicting owner instruction
Use: node scripts/season2-governance.cjs proposal path/to/instruction.json
Proposal example: {"id":"owner-proposal-2026","season":2,"changes":{"seasonal_rank.rollover":"retain"}}
A warning always names the misaligned rule. To accept an OWNER_REVIEW exception, attach an approval record with the digest emitted by the tool, ownerGitHubLogin, acceptedKeys, decisionId and reason. GitHub must verify a real owner review on the exact PR HEAD; a JSON field alone is not owner identity or release authorization. Change the policy version and add tests to actually adopt a new rule. HARD_BOUNDARY conflicts require a separate reviewed security/finance/production pathway and cannot bypass release gates.

## No more plan-only success
Check contracts/season2-implementation-ledger.json. PLANNED and BLOCKED never count as implementation. CI_VERIFIED, STAGING_SERVER_VERIFIED and RC_VERIFIED require evidence. The launch command fails until every required workstream is RC_VERIFIED or better; it never deploys anything.

## Error surveillance without admin overload
Use: node scripts/season2-governance.cjs health path/to/telemetry.json
Supply per-exact-sourceSha, appVersion, runtimeVersion and otaId windows of 15, 30 and 60 minutes. Missing data and small samples = YELLOW; security or finance incidents, unintended Season1 writes, severe crashes/ad first-view/nav regressions = RED. This script only classifies supplied snapshots; actual live telemetry ingestion, dedupe, alert delivery, rate controls, owner notifications, safe automatic remediation and recovery verification remain unimplemented. Never claim automatic monitoring or auto-fixing until connected and tested.

## Release gate
Current Season2 staging story exists; backend rewards and mission logic are not live. Do not create a second promotional announcement scheduler. DEV -> staging/RC -> separate owner exact SHA approved production after December 6 at earliest. The existing production embargo is independent and must remain. Check AdMob first-view fill, near-instant dashboard navigation, Android runtime compatibility, offline queues, security, signed Season1 reconciliation and exact EAS served manifest before release. A successful static test is not real-device QA.
