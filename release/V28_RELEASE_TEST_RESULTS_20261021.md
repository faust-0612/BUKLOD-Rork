# V28 remaining release gates — 21 October 2026

Status: **OTA NOT READY; CANDIDATE UNFROZEN**. Product source/assets unchanged. Start checkpoint dcd866b5; tooling fix e872d32c; typed router-test fix 2dce0331. No main merge, native build, workflow dispatch, database mutation or OTA.

## Fresh executed results

| Check | Actual result |
| --- | --- |
| Existing lockfile npm ci --ignore-scripts | PASS, 1,102 packages in 38s; bounded to 180s plus 5s kill grace. No package/lockfile edits. |
| Corrected router/Formation Jest suites | PASS, 8 tests; router rerun PASS after typed-return correction. |
| Full Jest regression | PASS, 93 tests across all 18 suites; zero failures. |
| Full TypeScript | PASS, zero diagnostics after restoring tracked local module declarations and correcting TS2339 in router test. |
| Targeted Node P0 and locked SDK integration | PASS, 28 tests: 23 behavioral tests plus 5 actual auth-js/PostgREST SDK cases using fake HTTP, never production writes. |
| Character visual lock / active renderer / Kingdom / base release contracts | PASS. Initial base-gate attempts exposed missing recovery files; final run passed after all 106 tracked migrations and required docs were restored. Expected absent-shell EAS project-ID warning remains. No SQL was executed from these migrations. |
| Product baseline reconciliation | PASS, all 1,217 source/asset files exactly match Git blob hashes; no missing/mismatching product files. |
| APK audit | PASS for expected APK fingerprint and 193 exact asset matches. Historical embedded-source parity remains UNPROVEN. |
| Controlled Android JS/Hermes export A/B | Both successful; 247 files each, every file SHA-256 identical. Not native builds. |

All test commands had 30–90s bounds. Each export has a 180s internal limit and a 195s outer limit with kill grace. No dependency recovery was left running indefinitely.

## Confirmed fixes

1. Locked Expo metro-config generates a random absolute `/tmp/expo-bundler-.../index.js` compiler input. Hermes embeds that filename in debug metadata and changes its checksum. A controlled unchanged-source test reproduced different absolute-path HBCs and identical relative-path HBCs. `scripts/export-v28-reproducible.cjs` uses the same pinned compiler, source bytes and flags with cwd set to the input directory and relative `index.js`. It uses Expo's documented compiler-directory override, without editing node_modules or app code. It does not strip/normalize output bytes. All 247 complete outputs now match exactly. Earlier discarded full-export artifacts were not available for byte-for-byte re-analysis; the prior 39 differences are historical evidence, not reinterpreted as an inspected current artifact.
2. The previous test-only router correction used `screen.getSegments()`, absent from the locked declaration of Screen. Use the typed `renderRouter()` return value instead, keeping the exact grouped-segment assertion. Actual renderer and full typecheck pass.

## Exact controlled export identity and limits

Hermes file: `_expo/static/js/android/index-2dab34059c2e35d011a10b174023d869.hbc`.

SHA-256: `0934c43594b122faeceb05c96267186868765151fd5c63fdb384c476209cc6c7`; 16,728,218 bytes; bytecode version 98; source hash header `261d65f4ab2b4865d3abc0b6ee06a0e3900aed87`. No random Expo temporary path remains. Full per-file hashes, compiler/tooling/input hashes and environment-input hash are recorded in the candidate/provenance JSON.

Both exports explicitly use `https://v28-verification.invalid` and `test-public-key`, production app variant, disabled dotenv/telemetry and offline CLI. These are controlled verification artifacts, **not production candidates**. They cannot establish equality with the historical production APK or production-environment reproducibility. Public environment values differ from the older run, so its HBC hash is not directly comparable to this HBC as a debug-only delta.

APK SHA-256 remains `820ff2c74e63a63a371b7b88466b24c4b0c324b1ae619a140e241c719f428a95`; embedded bundle SHA-256 `38a36b0a5ab7533f487ea227d47450805b4ac39cb7a5e96f3e2a57a8fadfc939`. No embedded source map/source-commit binding is available. Exact matching assets and repeatable new exports are partial evidence only. The documented alternative candidate qualification remains incomplete until Android acceptance and all mandatory gates pass.

## Backend / device blockers

Fresh SDK checks cover hung headers/body, credential isolation, late responses, explicit sign-out cancellation, invalid credentials and authenticated receipt-gated delivery with stable retry IDs. They use actual locked SDK 2.112.2 and fake HTTP. Prior live RPC compatibility/security checks are retained as historical evidence; no backend code changed.

Connected projects list shows Main Connect, inactive Attendance and dedicated Quiz; none is identified as a designated Main staging backend. No authorized non-production test session/endpoint is available in this run. Therefore no actual non-production BSOC receipt/referral end-to-end result is claimed, and production was not used as a substitute.

Physical candidate Android acceptance is NOT EXECUTED. `V28_ANDROID_ACCEPTANCE_20261021.md` supplies exact scenarios/outcomes, including loading deadlines, login/recovery, signup/referral and BSOC. Photos remain a separate measured unresolved investigation, with URL/expiry/cache/renderer/request evidence required before repair. No Community Wall media code was changed.

The verification worktree was reconstructed from upstream Git objects. Its local verification commit has the exact dcd866b5 tree and is intentionally not claimed as the upstream Git commit identity. Remote mutations use exact base trees and explicit file lists only; missing unrelated workspace files are never staged as deletions.
