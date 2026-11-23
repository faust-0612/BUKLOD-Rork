# BUKLOD MAIN Genesis 2.0.5 — consolidated staging OTA intake
Date: 2026-11-23 (PHT) | Status: DEV candidate, not published

## Signed native baseline
- Original-signed Android 2.0.5 staging APK: source `435e071da41c83071f545c9b209acb562863f7d2`, [successful run 45116010037](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/45116010037), artifact ID 14794360606; code17 and 4 Godot worlds passed native artifact QA; no on-device Godot acceptance.
- Current target: `org.mzbministry.buklod.staging`; `2.0.5-genesis-godot-launch`; `season2-genesis-library-205-preview`. This is a NEW native runtime; never publish into 2.0.4 `season2-genesis-library-preview` or production.
- Staging 2.0.4 already published [OTA run 45039223553](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/45039223553), group `7411bd8d-5c80-47c5-b120-e52570768ce5`. Do not replace or relabel its receipt.
- Latest 2.0.5 branch parent differs from signed APK only by a READ-ONLY workflow; this intake changes no native code, dependencies, runtime, assets or Supabase.

## Cumulative feature reconciliation
| Intake | Evidence | Status |
|---|---|---|
| Existing 2.0.4 approved Wall, video first-frame, comments, ads, navigation, theme, PTT, consent and call JWT corrections | [PR #1128](https://github.com/faust-0612/BUKLOD-Rork/pull/1128) native ancestry | Inherited |
| Outgoing call delivery feedback, ringback readiness, single busy/decline/missed outcome handler | [PR #1140](https://github.com/faust-0612/BUKLOD-Rork/pull/1140) | Ported to 2.0.5; device evidence still pending |
| Wall post edit/privacy/delete and media preserving transitions | [PR #1138](https://github.com/faust-0612/BUKLOD-Rork/pull/1138) (parallel Genesis [#1139](https://github.com/faust-0612/BUKLOD-Rork/pull/1139)) | Strict per-hunk port to 2.0.5; no duplicate re-application |
| Short-video comments/replies | [PR #1133](https://github.com/faust-0612/BUKLOD-Rork/pull/1133) | HOLD — diverged bubble and composer source; not safe for full-file replacement |
| Music picker, scrub, direct confirm, dual-track mix | [PR #1135](https://github.com/faust-0612/BUKLOD-Rork/pull/1135) | HOLD — migration `20261123133500_buklod_post_audio_mix_v1_20261123.sql` and private RLS/backend proof not completed |
| Public golden lifetime points and locked profiles | [PR #1106](https://github.com/faust-0612/BUKLOD-Rork/pull/1106) | HOLD — missing backend migration and verified account isolation |
| Cluster Admin attendance and full mentor lesson catalog | [PR #1087](https://github.com/faust-0612/BUKLOD-Rork/pull/1087) | HOLD — cluster review and mentor catalog RPCs absent from shared backend |
| IMCI + AJA Health | [PR #1107](https://github.com/faust-0612/BUKLOD-Rork/pull/1107) | HOLD — separate 2.0.0 RC, needs safe 2.0.5 port |
| Native Godot-first launch / complete worlds | [PR #1132](https://github.com/faust-0612/BUKLOD-Rork/pull/1132) | Signed APK built, Android crash/entry runtime not device-verified |
| Kingdom/Arena ranked, new native scenes, SOS, House/estate economy and authority | [PR #1074](https://github.com/faust-0612/BUKLOD-Rork/pull/1074) | HOLD — separate signed APK/backend/real gameplay gates |
| Report weekly auto-feedback | [PR #1114](https://github.com/faust-0612/BUKLOD-Rork/pull/1114) | HOLD — isolated Report web lineage and recipient verification |

## RC freeze / one consolidated OTA checklist
1. Before a publisher exists, pass engineering, protected ads, scroll/navigation, security, call, Wall/media, TS and Android Expo JS export on this exact head.
2. Diff this head against signed APK source and refuse all native/config/Godot/dependency differences. Do not silently rewrite Expo runtime, channel or production mapping.
3. Require a frozen RC and exact Android 2.0.5 source-proof publisher, idempotent EAS check/produce/readback of update ID+group+runtime+git SHA; production EAS branch and 2.0.4 branch unchanged.
4. Verify Android Godot tap/boot/crash/return and two-phone call delivery, audible local ringback, background/closed push, and ad first-view/tab responsiveness before claiming verified app behavior.
5. No Supabase production-hosted staging migration, APK/Play upload, production OTA or staging announcement from this DEV source. Re-run reconciliation after any main/Genesis change.
