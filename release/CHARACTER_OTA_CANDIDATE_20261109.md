# BUKLOD Character — isolated OTA candidate (2026-11-09)

## Scope
- **Backend, already live**: default `phan` without an explicit selection progresses according to verified lifetime points; the existing explicit selection baseline is never overwritten. Other characters still require explicit selection and begin at Level 1 on switch.
- **App JS-only**: fullscreen Character zoom requests full-source decoding using the already installed `expo-image` library, leaving thumbnail decoding lightweight. Live Character level refresh updates the selected preview only if the user has not manually browsed to another stage.
- **Assets**: approved five core sprite assets unchanged; no native config changes, app version increments, or new dependencies.

## Source / destination
- Main source baseline: `ca8e7e508b13e197b0c86aaf3d275962d977d157`.
- Reviewed DEV work: `ace045aef36b6d6102fceb8d7dc11e248208c9b0`.
- Isolated RC branch: `rc/character-zoom-default-progress-20261109`.
- Main app EAS runtime from `app.config.js`: `1.3.2`; production update channel from `eas.json`: `production`. **Do not presume installed-build/runtime parity without checking the intended release target.**
- Production backend migration version: `20261109105129` (`character_implicit_phan_progress_r1_20261109`), already present in migration history.

## Server verification
- The reported affected account has verified 905 lifetime points, Circle Rank 4, calculated active default Phan Level 5. No saved explicit selection was overwritten.
- Account-wide inspection found 44 accounts with lifetime balances but no explicit selection; 5 earned a level beyond Level 1 under the default Phan rule.
- Existing explicitly selected Character records remained 17; all baselines nonnegative.

## Release checklist
1. Freeze RC and ensure it remains ahead of current main without unrelated code.
2. Pass existing `npm run character:contract`, `node --test tests/character-rc-modern-lock.test.mjs tests/character-zoom-quality-r1.test.mjs tests/character-default-phan-migration-r1.test.mjs`, release gate, and applicable bundling/asset checks in the release environment.
3. Validate target Android artifact's exact runtime `1.3.2` and update channel; never redirect to staging or Classroom.
4. Publish only after RC signoff, then verify the exact published update/group/asset manifest and successful production delivery (not established here).
5. Backout if rendering or level synchronization regresses; do not roll back the verified backend correction by resetting user points.

Actual device/user verification is **explicitly skipped by owner request**. Skipping it is not evidence that the Android client was tested. This RC is **not a production OTA publication**.
