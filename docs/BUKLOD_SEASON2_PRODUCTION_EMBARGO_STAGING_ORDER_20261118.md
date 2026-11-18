# Season 2 release separation — owner directive, 2026-11-18

**Only PRODUCTION is embargoed before 2026-12-06 00:00 Asia/Manila.** Season 2 staging is allowed earlier **after** the current fixes from verified staging Train A have been published and verified on the production channel. No calendar embargo on staging.

## Ordered trains

1. **Train A — current fixes production**: take verified staging Android update `01a1ed41-f555-7bba-b0d3-1c2b3843ceca` from source `6a33d05e85121d3d8a0a6760ef6b2e84c6c6721e`, rebuild an independently verified **production-identity** Android RC with production EAS env; never copy staging env, binary or AdMob units into production. Preserve owner-approved exclusion of new auth patch, but validate existing auth/security. Confirm real AdMob first-view fill, offscreen lifecycle, dashboard latency and signed runtime on actual device before production. Record the live production update ID, exact production source SHA, CI run, owner authorization, and actual device evidence in `.buklod/releases/current-fixes-production-verified.json`. No evidence => no claim of production.
2. **Season 2 staging**: only after step 1 and an authenticated live production manifest match. `node scripts/buklod-season2-staging-order-gate.cjs` is a fail-closed prerequisite for every Season 2 staging publisher. The Season 2 DEV branch remains draft until it passes. This step **may occur before Dec 6** and is not blocked by production embargo.
3. **Pre-Dec 6 non-Season2 hotfixes**: production releases are allowed through existing AdMob/auth/security/native/RC gates; do not include Season2 runtime imports, screens, points, tokens, missions, banners or scheduled launch notifications. Preserve an explicit changed-file ledger and reconcile shared paths into Season2 DEV; rerun Season2 regression and character/finance tests.
4. **Season 2 production**: prohibited before `2026-12-05T16:00:00.000Z` (Dec 6 00:00 Manila), and after that remains blocked until exact-SHA owner approval, verified Season1 closure, backend/migration/ledger reconciliation, staging Android AdMob/navigation evidence and published schedule. The canonical production workflows already call `scripts/buklod-season2-production-embargo.cjs --production`. Date passage is **not** automatic authorization.

## Reconciliation ledger

| Component | Current fix source | Season2 action |
| --- | --- | --- |
| Android dashboard / tabs | Train A PR #940 | Preserve first-view ads and no-auth change; integrate only after production source recorded |
| Wall/video/Community/Connect/Henry | Train A PR #940 | Merge tested behavior without replacing Season2 story, account/character ownership or QMP |
| Existing nonseason production hotfixes | Later verified main SHA | Cherry-pick only missing fixes, conflict-resolve, retest |
| Season2 narrative, guides, chapters, vault | DEV PR #939 | Staging-only until launch authorization |
| BP/QMP, AdMob, Character inventory | Production server authority | Never convert a design preview into minted financial/character rewards |

**Important:** The Season2 staging-order script is only a contract. It must be invoked by the actual future Season2 staging publish workflow before any EAS update. No Season2 staging or production OTA is authorized by this document. No production receipt file is generated automatically.
