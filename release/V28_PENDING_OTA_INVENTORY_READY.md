# BUKLOD V28 Pending OTA Inventory — PUBLISHED

**Status:** OTA PUBLISHED  
**Target:** Android production channel, runtime **1.3.2**, versionCode **28**  
**Timezone note:** times below converted to Asia/Manila

## Verified prior live OTA (before this publish)

| Field | Value |
|---|---|
| Android update ID | `01a16362-bf5f-77fc-baa3-09e1112510fa` |
| Update group ID | `576f18e4-df4d-4ad4-9fb6-0d8f9b5d5798` |
| Runtime | 1.3.2 |
| Commit | `ca5918ff` (dirty flag in Expo) |
| Published | 2026-10-22 ~19:32 Asia/Manila |
| Workflow | https://github.com/faust-0612/BUKLOD-Rork/actions/runs/39770909298 |
| Message | Wall chips/Dugtong removal + KL Chap2+ approval / reader live discussion |

Included cumulative scopes already on that baseline: Character, Cluster create (no mother org + org search), Bayanihan/Economy, Marites, non-PTT call restore, weak-network/offline, Wall weak-signal helpers, referral/auth, Connect, KL 6pm desk, ABAKA, cardColor, Today/comment/Wall chip cleanup (#256 and earlier).

**Gap verified:** `015cacd3` (AAB v28 video-only fullscreen Wall) was on `main` but **not** in that OTA (path filter miss on `CommunityVideo.tsx`).

## Newly published OTA (this run)

| Field | Value |
|---|---|
| Android update ID | `01a1639c-02e0-766f-8721-b17c383bb270` |
| Update group ID | `250cb4d6-2e10-4065-97c2-83de04f9f443` |
| Runtime | 1.3.2 |
| Platform | android |
| Channel/branch | production |
| Commit | `b72a05c4` |
| Published | 2026-10-22 ~20:35 Asia/Manila |
| Workflow | https://github.com/faust-0612/BUKLOD-Rork/actions/runs/39779024164 |
| EAS | https://expo.dev/accounts/faust_0612/projects/buklod/updates/250cb4d6-2e10-4065-97c2-83de04f9f443 |
| Message | Runtime 1.3.2 pending OTA: cluster search + join notif approve/decline; Wall photo rollback failsafe; cumulative V28 live bundle |

### Newly added vs prior live OTA

1. Cluster live search + join-request Approve/Decline (invite Accept/Decline)
2. Wall photo rollback failsafe (never delete uploads after ambiguous publish)
3. AAB v28 video-only full-screen Wall viewer

## Full inventory (all now in published OTA source)

| # | Scope | Status |
|---|---|---|
| 1 | V28 Character layout | LIVE (prior + this) |
| 2 | Cluster create no Mother Org + org search | LIVE (prior + this) |
| 3 | Bayanihan / Economy | LIVE (prior + this) |
| 4 | Marites | LIVE (prior + this) |
| 5 | False call / non-PTT restore | LIVE (prior + this) |
| 6 | Weak-network / offline cache | LIVE (prior + this) |
| 7 | Wall weak-signal helpers | LIVE (prior + this) |
| 8 | Referral + sign-in resilience | LIVE (prior + this) |
| 9 | Connect chat / Seen / composer | LIVE (prior + this) |
| 10 | KL + Chap2+ 6pm approval | LIVE (prior + this) |
| 11 | ABAKA @ 1.3.2 | LIVE (prior + this) |
| 12 | Cluster Home cardColor | LIVE (prior + this) |
| 13 | Buklod Today blank reply | LIVE (prior + this) |
| 14 | Wall comment composer | LIVE (prior + this) |
| 15 | Remove Public CONNECT/EXPLORE + Dugtong | LIVE (prior + this) |
| 16 | AAB v28 video-only fullscreen Wall | **NEW in this OTA** |
| 17 | Cluster live search + join notif actions | **NEW in this OTA** |
| 18 | Wall photo rollback failsafe | **NEW in this OTA** |

## Device step

Open production APK (runtime 1.3.2) → pull update → confirm update ID / behavior above.
