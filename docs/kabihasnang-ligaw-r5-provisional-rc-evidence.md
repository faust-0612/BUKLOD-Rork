# Kabihasnang Ligaw R5 — provisional RC evidence

This release candidate is **not frozen**. V28 production is not treated as confirmed live. No production baseline was reconciled. No APK, OTA, deploy, or production database change was made.

## Branch

- Cloud branch: `cursor/kabihasnang-ligaw-r5-3b41`
- Base branch: `dev/kabihasnang-ligaw-dashboard-r5`
- Base SHA: `77c629c0546cb0a03ddcf40f49999fc7c6d02b63`
- `9ec877e847c2b80a0be2adcb639b64be473cbf3c` catalog, media gate, reward plans
- `5adc3d6519a5707a4c2717cf23655f196f4b70da` reader shell and story admin review
- `a55da258a48dfcf9627f64a8e4b578b0aba93021` additive SQL, not applied

`main` was not updated. Codex V28 work was not rebased or pushed.

## Checks

| Command | Result |
|---|---|
| `npx tsc --noEmit --pretty false` | Pass, exit 0 |
| `node --experimental-strip-types scripts/run-kl-r5-checks.mjs` | Pass, 11 checks |
| `npm test -- --testPathPattern=kabihasnangLigawR5 --watchAll=false --watchman=false` | Fail, exit 127, `jest: not found`. `jest-expo` is not in `package.json` or `package-lock.json`. |
| Low-end Android emulator | Not run. `emulator`, `adb`, and `docker` are absent on this VM. |
| `supabase db push` / production SQL | Not run |

## Content

- Manuscript: CONTENT BLOCKED. Panimula and Kabanata 1 are not byte-preserved because the complete text is not in the repo.
- Manifest: `docs/kabihasnang-ligaw-r5-media-storyboard-manifest.json`
- Image approval: pending. No illustration `approved` flag is true.
- Audio: MISSING. Controls stay silent. No oscillator.
- Jawo/Javvo: unresolved and unpublished.

## After V28

Reconcile the live production baseline, re-verify, obtain owner creative sign-off, freeze the release candidate, then run an authorized Android production OTA.
