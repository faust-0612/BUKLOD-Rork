# P0 + R5 gate record — 2026-10-21

RC frozen: **NO**. OTA published: **NO**. Production Supabase was not changed. R5 stays disabled.

## Live Android production baseline

Project `23dad7d0-389a-406e-8dec-08965dab85d8`, channel `production`, platform Android. Read from `https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8` on 2026-10-21.

| Runtime | Protocol | Result |
|---|---|---|
| 1.3.4 | 0 | HTTP 404, no available update |
| 1.3.4 | 1 | HTTP 204, `expo-reason-code: NO_UPDATE_AVAILABLE` |
| 1.3.2 | 1 | HTTP 200. Newest production manifest by `createdAt` |

Live group: runtime **1.3.2**, app version **1.3.2**, versionCode **25**, created `2026-10-16T07:48:08.792Z`, manifest `01a143ae-c1d8-776c-984d-0d6cbcefc467`, update group `40ec8105-eaeb-4335-a0f2-7d08ca76e202`. Manifest extra has no git SHA.

Source on this branch still declares version `1.3.4`, versionCode `28`, runtimeVersion `1.3.4`. That runtime is not the live update group. `origin/main` remains `22ca71de2d993aaebcd19ccff65e4f40884209d4`.

## R5

Kept disabled. Panimula SHA-256 `78195ad435ba17ae033ec6d5649813edd85411b70189a437bf502db96cce77c2`. Kabanata 1 SHA-256 `fef559f06b20884bb57fd36898c44a1174293a2324823f02af17b48eff463173`. Episodes 2–30 stay outline-only. Jawo/Javvo is unresolved. Required illustration and audio assets stay `MISSING`. No original scene art or rights-cleared audio was produced in this run. Members do not receive draft prose. No production SQL.

## P0 included

- Selected referral codes attach once. An unresolved name fails closed instead of being sent as a code.
- `buklod_record_referral_v1` is not treated as a cached read.
- Safe reads and password grants time out. A second password attempt cannot inherit another attempt's session. Sign-out cancels the in-flight grant.
- Saved content stays visible when a refresh hangs, and the failure is reported with a fixed operational label.
- Cloudflare HTTP 522 is a transient auth failure.

Not ported: open login-copy, birthday-recovery, fast-loading, and global-offline branches. They overlap this auth and cache work or touch PTT, ads, or Character, and were not re-proven here.

## Commands on this cloud VM

| Command | Result |
|---|---|
| `npx tsc --noEmit --pretty false` | Pass, exit 0 |
| `npx jest --watchAll=false --watchman=false --runInBand` | Pass, 19 suites, 104 tests |
| `node --test tests/v28-p0-source.test.cjs` | Pass, 23 tests |
| `node --experimental-strip-types scripts/run-kl-r5-checks.mjs` | Pass, 11 checks |
| Character, Kingdom, and base release contracts | Pass. Base gate warns that the EAS project id is not in the shell. |
| Isolated PostgreSQL 16.15 database `kl_r5_isolated`: bootstrap, `20261020120000`, `20261021153000`, `20261021234500`, `scripts/kl-r5-isolated-db.sql` | Pass. Drafts hidden, non-admin refused, approve blocked until art and audio exist, one episode per Manila day, first completion +2, replay +0. No bayanihan ledger. Not applied to production. |
| Two `kl_post_points_v1` calls on `kl:race:v1` | 1 ledger row, 2 points. One call `already: false`, the other `already: true`. |
| `adb devices` | Fail, exit 127, `adb: command not found` |
| `emulator -list-avds` | Fail, exit 127, `emulator: command not found` |
| `command -v sdkmanager` | Exit 1, not installed |
| `npx --yes eas-cli whoami` | `Not logged in`. No `EXPO_TOKEN` in the environment. |

## Publish

Not run. Rollback of this source change is `git revert` of the P0 commits on the DEV line. Do not run `scripts/PUSH_MAIN_OTA.ps1` (it targets runtime 1.3.3) and do not run `npx eas update`.
