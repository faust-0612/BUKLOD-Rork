# V28 P0 release evidence — 20 October 2026

Candidate only; RC UNFROZEN and OTA NOT READY.

| Check executed | Actual outcome |
| --- | --- |
| Existing lockfile `npm ci --ignore-scripts` | PASS; 870 declared packages restored before test setup repair. |
| Updated lockfile `npm ci --ignore-scripts --dry-run --offline` | PASS. No existing locked package version changed or disappeared; runtime root dependencies unchanged. |
| Full `tsc --noEmit --pretty false` | PASS; zero diagnostics. |
| Existing targeted Node P0 suite | PASS; 23 tests. |
| New locked-SDK integration suite | PASS; 5 tests using auth-js/supabase-js 2.112.2, fake HTTP and memory storage. Includes stuck headers/body, cross-attempt isolation, sign-out cancellation, invalid credentials and authenticated receipt-gated health delivery. |
| Full repository Jest suite | FAIL; 89 passed, 2 failed; 16 suites passed, 2 failed. |
| Affected Foundation/scope P0 Jest suites | PASS; 5 tests in 2 suites, with original assertions and imported TypeScript types retained. |
| Character visual lock, active renderer, Kingdom and base release gates | PASS. Base gate reports the expected absent-shell EAS project-ID warning. |
| Product-source/asset Git blob comparison | PASS; 1,217 exact matches to parent baseline; no product or media edits. All 207 tracked assets restored and verified. |
| APK fingerprint and resource comparison | PASS for the known APK fingerprint; 193 repository assets match exact APK bytes. Full APK/source parity remains UNPROVEN. |
| Controlled Android JS export A and B | Both commands succeeded without native builds. Their output differs in one Hermes bundle, so repeatable byte identity FAILS. Environment uses explicit `.invalid` public placeholders; exports are not production release artifacts. |
| Android physical-device candidate tests | NOT EXECUTED; checklist and required artifact identity documented. |

## Full regression failures retained

1. `router.smoke.test.tsx`: test expects `/(auth)/login`; rendered pathname is `/login`.
2. `formationUi.test.ts`: test expects positive progress for empty curriculum 106; current helper returns `0`.

These tests and their product modules are unchanged from the parent source. No assertion was weakened and no unrelated routing or Formation behavior was changed to obtain a green suite.

## Test setup repairs

The repository already declared a Jest command/preset, Testing Library matcher setup and existing Jest tests. The missing test-only dependencies are now pinned, including a React test renderer matching React 19.2.3. The current Testing Library public matcher entry point and official AsyncStorage Jest mock are used. P0 tests use typed CommonJS loads so `jest.doMock` works without an ESM VM runtime switch. There is no production application change in this continuation.
