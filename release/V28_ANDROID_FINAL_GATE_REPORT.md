# V28 Android cumulative DEV — publication blocked

This is a DEV integration and release-policy repair, not a frozen RC or a new production OTA.

## Production evidence

- Target: project `23dad7d0-389a-406e-8dec-08965dab85d8`, Android, channel `production`, runtime `1.3.2`.
- Requested update `01a162c0-c183-70a8-92a6-a7116581d5e1` was observed at the production manifest endpoint, created `2026-10-22T08:36:02.051Z`, version `1.3.4`, code `28`.
- A newer production update was subsequently observed: `01a162ef-71f7-7959-9630-526dbb390882`, created `2026-10-22T09:27:01.879Z`, same runtime. Its launch bundle SHA256/base64url is `KdDa8TGxSZuCmo0TpF-BwKXLLUKSuTWNLBge8LXjj7c`.
- Successful GitHub production run `39754966273` reports source `1287392ca0b847314dd79982ae384103577b0ce9`. The public manifest does not independently expose that Git SHA, so this is reported workflow provenance, not a verified byte-for-byte source match.
- EAS CDN bundle download and GitHub redirected log download were denied by the current egress policy. Domain additions were saved in the cloud environment draft; they are not evidence of applied runtime access.

## Feature classification

LIVE identifies only what the production endpoint independently confirms. Source evidence alone is not sufficient to label a feature LIVE.

| Scope | Classification | Evidence / boundary |
|---|---|---|
| Android update target and runtime | LIVE | IDs/runtime above observed from production manifests. |
| Cluster without mandatory Mother Organization | SOURCE ONLY; live linkage unverified | Current main supports null organization and optional UI; retained unchanged. |
| Bayanihan/Economy ledger/dashboard | SOURCE ONLY; live linkage unverified | Current main contains the ledger/dashboard; retained unchanged. No database changes. |
| Latest Character design/progression | BLOCKED for release | Current approved-source design retained; existing visual/gating contract fails 18 checks. No old UI restored and no expected hashes relaxed. |
| V28 Marites | SOURCE ONLY; live linkage unverified | Current main already contains paged feed implementation; retained unchanged. |
| False call/PTT indicators | BLOCKED for device verification | Existing RingingCalls excludes buklod_ptt. No PTT was added/restored by this integration; absence and native foreground indicators require actual binary/device verification. |
| Global cache, stale protection, referral validation | SOURCE ONLY; live linkage unverified | Current cumulative source retained; PR234 scoped registration/reward changes are already present. 23 P0 regression tests passed. |
| Weak-signal Community Wall | SOURCE ONLY — new DEV integration | Selectively forward-ported commits 7f811e1 and 0424589. Preserved current follow-back enrichment and startup deferral; text-first paint, account/generation isolation, authoritative revoked-media clearing. Existing 12 weak-network tests passed. |
| Sign-in interruption resilience | SOURCE ONLY — new DEV integration | Only PR248's three scoped files/diff forward-ported; single-flight/no-retry and active-account gate retained. |
| Connect follow-back, history, pagination | SOURCE ONLY; live linkage unverified | Current main already includes Connect PR243-era source; no older branch replacement. Review-only group Seen/backend requirements are not represented as live. |
| Approved KL reader/content | SOURCE ONLY; live linkage unverified | Current main reader/manuscripts/stills retained byte-for-byte. Existing reader tests passed. No migration or content approval-state changes. Backend-dependent functionality is not newly enabled by this OTA. |
| Draft/HOLD features | PR ONLY; excluded | No blanket merges of open draft/HOLD feature branches. |
| Original V28 cloud binary and native compatibility evidence | MISSING / BLOCKED | Only reference hashes are available; no authoritative AAB/native inventory was located in this cloud workspace or inspected cloud artifacts. |

## Verification

- TypeScript passed after integration and test-harness corrections.
- Jest initially executed 106 tests: 99 passed, 7 failed in four pre-existing fixture/harness suites. Reused previously reviewed fixes for Router group/path expectations, supported Jest import/matcher setup, and Formation denominator fixtures (including additional assertions). The four affected suites then passed all 13 tests. Combined coverage is 20 suites / 108 tests across those runs, not a claimed single green full-suite run.
- Node V28 P0 suite: 23 passed, including real 24-second password transport timeout/cancellation cases.
- Android policy/runtime tests: 5 passed, including wrong target/SHA/authorization rejection and missing readiness evidence rejection.
- Kingdom game source contract passed.
- Character source contract FAILED with 18 blockers. The integration does not change Character source, artwork or expected contract hashes to conceal this.
- No Android export was performed after the required Character gate failed. No native APK/AAB or iOS build was run. No emulator/device/authorized test session is available for the required native critical-flow checks.

## Repaired release route

The canonical publisher is manual-only, accepts an exact 40-character RC SHA and explicit confirmation, checks runtime/project/channel/platform, fails closed on credentials, uses the existing EAS production environment, requires functional/native-readiness evidence, reuses one exact Android export, stops if the live baseline changes, and verifies the published update ID/source plus live launch-asset hash against the RC export. EAS CLI 25.3.0 flags/output fields were inspected from the registry package without a publish.

Ten legacy Android production publishing entry points are retired on this DEV branch so ordinary pushes/manual legacy jobs cannot bypass canonical release gates. Their source remains available for historical review. No test assertion or current Character release gate was disabled to make the candidate pass. Existing application production functionality is retained.

PR250's cloud policy and PR247's runtime registry/guard were selectively reconciled on top of latest main rather than replacing main with a diverged old branch. No production workflow was dispatched by this task. Branch changes do not themselves activate policy on main.

## Remaining real release gates

1. Compare the new Character source/contract against the approved original V28 artifact via an existing restricted cloud artifact reference; review any contract re-baseline explicitly rather than restoring old code or accepting changed hashes automatically.
2. Verify original-binary native module compatibility and native critical flows (including no false call/PTT indicators) using the installed V28 binary on an authorized cloud/device test environment. A runtime string alone is not a native compatibility proof.
3. Verify the latest cumulative production bundle/source linkage and backend-dependent features without database mutation. Features requiring a migration/native rebuild remain excluded until separately authorized.
4. Only after these gates pass, create matched readiness evidence, freeze an immutable RC, and use the existing working GitHub Actions Expo credential. Do not request a duplicate Expo token merely because it is not injected into this machine.

Release result: BLOCKED. Frozen RC SHA: none. New production update ID: none. Existing production update is preserved. No web deploy, database mutation, paid upgrade, or local-PC operation occurred.
