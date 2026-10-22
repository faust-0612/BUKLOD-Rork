# BUKLOD V28 Pending OTA Inventory — READY

**Status:** READY for OTA  
**Target:** Android production channel, runtime **1.3.2**, versionCode **28**  
**Source tip for this bundle:** (see PR branch after merge to `main`)  
**Generated:** 2026-10-22 (Asia/Manila)

## Complete inventory (all OTA scopes)

| # | Scope | Status on source |
|---|---|---|
| 1 | V28 Character layout / progressive selector | ON MAIN (prior live OTA) |
| 2 | Cluster create without required Mother Organization + org search | ON MAIN (#256) |
| 3 | Bayanihan / Economy ledger dashboard | ON MAIN (prior live OTA) |
| 4 | V28 Marites board | ON MAIN |
| 5 | False ongoing-call / non-PTT restore (PTT stays removed) | ON MAIN (#256) |
| 6 | Global weak-network / offline cache / sync coordinator | ON MAIN (#256) |
| 7 | Community Wall weak-signal helpers + text-first limits | ON MAIN (#256) |
| 8 | Referral + sign-in interruption resilience | ON MAIN (#256) |
| 9 | Connect chat newest history / Seen / composer above nav | ON MAIN |
| 10 | Kabihasnang Ligaw reader + Chap2+ approval + 6pm desk | ON MAIN (OTA published) |
| 11 | ABAKA on runtime 1.3.2 | ON MAIN |
| 12 | Cluster Home theme `cardColor` | ON MAIN (#256) |
| 13 | Buklod Today blank reply / hold-while-writing | ON MAIN |
| 14 | Wall comment composer (photo/GIF/reaction) | ON MAIN |
| 15 | Remove Public CONNECT/EXPLORE + Dugtong | ON MAIN |
| 16 | AAB v28 video-only full-screen Wall viewer | ON MAIN |
| 17 | **Cluster live search + join-request Approve/Decline on Notifications** | **THIS PR** |
| 18 | **Wall photo rollback failsafe (never delete uploads on ambiguous publish)** | **THIS PR** |

## Explicitly excluded (not OTA blockers)

- Full Community progressive-feed whole-file rewrite from older wall branch (would regress newer main Wall features)
- Draft/HOLD PRs not approved for this cumulative (#220 Kingdom HOLD, Quiz held issues, etc.)
- New AAB / native rebuild / web deploy
- Exact AAB-era Cluster/Org home chrome rollback (newer main home extras retained by design)

## Verification

- TypeScript: `npx tsc --noEmit` PASS
- Photo rollback: `node --test tests/community-photo-rollback-safety.test.cjs` — 6/6 PASS
- Cluster join helpers: lightweight node assert PASS
- Runtime config: `runtimeVersion: 1.3.2`, `versionCode: 28`

## Publish path (owner / CI)

1. Merge this PR to `main`
2. Canonical Android production OTA via `production_android_ota.yml` (path filters include new Cluster + media files) or `scripts/PUSH_MAIN_OTA.ps1`
3. Confirm Expo update ID + runtime 1.3.2 on production channel
4. Live device verify on installed V28 APK

**READY for OTA** — source cumulative; publish remains the separate Expo step.
