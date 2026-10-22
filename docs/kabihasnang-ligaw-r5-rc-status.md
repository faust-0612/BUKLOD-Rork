# Kabihasnang Ligaw R5 — RC status

**RC frozen: NO.** OTA was not published. Production Supabase was not changed. This file records the cloud run; it is not owner approval.

## Text

Canonical files, byte-compared with the reader catalog:

| File | SHA-256 | Bytes |
|---|---|---|
| `content/kabihasnang-ligaw/panimula.md` | `78195ad435ba17ae033ec6d5649813edd85411b70189a437bf502db96cce77c2` | 1983 |
| `content/kabihasnang-ligaw/kabanata-01.md` | `fef559f06b20884bb57fd36898c44a1174293a2324823f02af17b48eff463173` | 12872 |

Panimula begins `### KABIHASNANG LIGAW` and ends `hinintay na marinig.` Kabanata 1 begins `### UNANG SERYE` and ends `WAKAS NG KABANATA 1`. Paragraph ids are `kl-e00-p001` and `kl-e01-pNNN`. Episodes 2–30 have no prose. Both imported episodes stay `draft` with `approvedAt` null. Members do not receive the text until the server says the episode is visible.

## Assets and audio

- Scene art: **BLOCKED. Pending owner.** No original scene images were generated. No license or provenance record exists. No stock image was substituted.
- Audio: **BLOCKED. Pending owner.** No rights-cleared music or ambient file exists. The owner has not waived this gate. Controls stay silent. No oscillator was added.
- Chapter 1 rain is forbidden. The closing missing-shadow and duplicated-voice scene is not shown before its paragraph.
- Jawo/Javvo is unresolved and unpublished.
- `release/BUKLOD_ENGINEERING_CHARTER.md` is absent on this branch and on `origin/main`.

## V28

Live Expo project `23dad7d0-389a-406e-8dec-08965dab85d8`, Android, protocol 0:

- runtime `1.3.4`, channel `production`: HTTP 404, `There is no available update for the runtime "1.3.4"`.
- Protocol 1 for the same request: HTTP 204, `expo-reason-code: NO_UPDATE_AVAILABLE`.
- Newest production manifest found by createdAt among runtimes 1.3.0, 1.3.2, and 1.3.3 is runtime **1.3.2**, version **1.3.2**, versionCode **25**, created `2026-10-16T07:48:08.792Z`, manifest `01a143ae-c1d8-776c-984d-0d6cbcefc467`, update group `40ec8105-eaeb-4335-a0f2-7d08ca76e202`. The manifest extra did not include a git SHA.
- `origin/main` is `22ca71de2d993aaebcd19ccff65e4f40884209d4`. `app.config.js` there says version `1.3.4`, versionCode `28`, runtimeVersion `1.3.4`. Commit `cbd650bc6113e832d2520986bb76bb1359d4181b` says “BUKLOD 1.3.4 v28”. That runtime has no published update.

**V28 UNVERIFIED** as the live production update group. R5 is not reconciled onto a verified live V28 baseline, so it stays unfrozen.

## Checks from this cloud run

| Command | Result |
|---|---|
| `node --experimental-strip-types scripts/run-kl-r5-checks.mjs` | Pass, 11 passed |
| `npx tsc --noEmit --pretty false` | Pass, exit 0 |
| `npx jest --testPathPattern=kabihasnangLigawR5 --watchAll=false --watchman=false --runInBand` | Pass, 11 passed |
| Isolated PostgreSQL 16.15 database `kl_r5_isolated` on this VM: bootstrap, `20261020120000`, `20261021153000`, `20261021234500`, then `scripts/kl-r5-isolated-db.sql` | Pass. Drafts hidden, non-admin refused, approve blocked until art and audio flags exist, one episode per Manila day, first completion +2, replay +0. Not applied to production. |
| Concurrent `kl_post_points_v1` on source key `kl:race:v1` | 1 ledger row, 2 points. One call `already: false`, the other `already: true`. |
| `emulator`, `adb`, `docker` | Absent. Low-end Android performance: **CLOUD BLOCKED**. |

## Rollback

See the header of `supabase/migrations/20261021234500_kabihasnang_ligaw_r5_canonical_text.sql`. Do not run it against production.

## Publish command — do not run

`scripts/PUSH_MAIN_OTA.ps1` prints runtime 1.3.3 and runs:

```
npx eas update --channel production --environment production --platform android --message <message> --non-interactive
```

That command was not run.
