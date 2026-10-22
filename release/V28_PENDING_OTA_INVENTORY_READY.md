# BUKLOD V28 Production OTA — Endless boot loading fix

**Status:** OTA PUBLISHED  
**Target:** Android production channel, runtime **1.3.2**, versionCode **28**  
**Timezone note:** times below converted to Asia/Manila

## Verified prior live OTA (before this publish)

| Field | Value |
|---|---|
| Android update ID | `01a1639c-02e0-766f-8721-b17c383bb270` |
| Update group ID | `250cb4d6-2e10-4065-97c2-83de04f9f443` |
| Runtime | 1.3.2 |
| Commit | `b72a05c4` |
| Published | 2026-10-22 ~20:35 Asia/Manila |
| Workflow | https://github.com/faust-0612/BUKLOD-Rork/actions/runs/39779024164 |
| Message | Runtime 1.3.2 pending OTA: cluster search + join notif approve/decline; Wall photo rollback failsafe; cumulative V28 live bundle |

## Newly published OTA (this run)

| Field | Value |
|---|---|
| Android update ID | `01a163c9-33c1-7be2-8f87-aa9ade2c562b` |
| Update group ID | `810369da-69d0-4ea1-a8cb-0c58e730051a` |
| Runtime | 1.3.2 |
| Platform | android |
| Channel/branch | production |
| Commit | `94ca01a6` |
| Published | 2026-10-22 ~21:24 Asia/Manila |
| Workflow | https://github.com/faust-0612/BUKLOD-Rork/actions/runs/39786086190 |
| EAS | https://expo.dev/accounts/faust_0612/projects/buklod/updates/810369da-69d0-4ea1-a8cb-0c58e730051a |
| Message | Runtime 1.3.2 OTA: stop endless app loading (Public bootReady + auth shell); cumulative V28 live bundle |

### Newly added vs prior live OTA

1. Stop endless index loading: optimistic Public `bootReady` + 4s watchdog (`index.tsx` / `index.web.tsx`)
2. Auth shell release after session is known (profile hydrates in background)
3. Regression contract test `__tests__/buklodBootReadyPublicReset.test.ts`

## Device step

Open production APK (runtime 1.3.2) → pull update → confirm update ID `01a163c9-33c1-7be2-8f87-aa9ade2c562b` and cold-start no longer stuck on spinner when last workspace was Organization/Cluster.
