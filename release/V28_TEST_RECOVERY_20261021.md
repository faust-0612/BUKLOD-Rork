# V28 test-only recovery — 21 October 2026

Parent: `09ac591978e77aae24676e72b92c75eac1fe2a0b`. Candidate remains UNFROZEN / OTA NOT READY.

## Narrow corrections

- Router smoke harness: public pathname is `/login`; `(auth)` is a route group. Preserve the grouped initial URL and login-content assertion; additionally assert grouped segments `['(auth)', 'login']`. Prior actual renderer evidence recorded `/login`. No application routes changed.
- Formation fixture: no assigned lessons and neither points nor bayanihan gate met means 0 completed gates. Correct the unsupported positive-percent expectation to exact 0. Add exact 50/100 completed-gate cases and 25% assigned-lesson coverage. Preserve IN_PROGRESS, historically locked and access-denied assertions. No progress implementation changed.

## Actual focused verification

PASS: all 7 cases in corrected `formationUi.test.ts`, executed against exact parent `formationUi.ts` and `formationCopy.ts` using Node 24.19.0 type stripping, VM and strict Node assertions. This is not a Jest run.

PASS: router static assertion contract retains grouped initial route, checks public `/login`, asserts grouped segments and retains visible LOG IN assertion. React Native/Expo Router rendering was NOT rerun.

PASS: inspected diff contains only the two test corrections and this evidence file. Product source, runtime dependencies, lockfile, media and P0 implementation remain unchanged.

Jest executable and renderer dependencies are unavailable in the recovered workspace. No dependency installation was required or attempted in this recovery. All shell verification commands were bounded to 5–15 seconds.

## Remaining release gates

- Run focused and full Jest with the declared locked dependencies; do not claim the previous 89-pass/2-fail result has become a green rerun.
- Complete controlled repeated Android JS/Hermes exports and explain differing bytes; previous reproducibility failure remains open.
- Historical APK-to-source binding remains unproven; exact asset matches are partial evidence only. Complete the documented controlled candidate qualification method.
- Physical candidate Android acceptance and authenticated non-production end-to-end receipt evidence remain pending; existing V28_ANDROID_VERIFICATION_20261020.md specifies scenarios and expected outcomes.

No RC freeze, main merge, workflow dispatch, native build, backend mutation or OTA publication.
