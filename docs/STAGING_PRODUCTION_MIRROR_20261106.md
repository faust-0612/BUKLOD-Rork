# Corrective V28 source-of-truth audit — 2026-11-07

**RELEASE HOLD: binary parity with the Google Play V28 AAB is NOT VERIFIED.**

- GitHub run [42239922427](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/42239922427) successfully built staging APK `5e405239-a04b-4995-bb35-ef4b21df35be` and published staging-user Android runtime 1.3.2 update from Wall RC `804cb557`. That proves a successful staged build/update, **not** equivalence to the Google Play production V28 AAB.
- The build checked out current Git `main` at `8e1956e`, **not a verified AAB build source or binary**. Comparing `main` with the Wall RC proved a Git-tree relationship only.
- The repository's `release/approved-android-baseline.json` intentionally lacks approved binary hashes and reconciliation evidence. Its own note explicitly says V28 is reference only. The actual V28 production AAB was a **local Gradle build**, not EAS, made Oct 18, 2026. Its previously recorded original SHA-256 is \`E735885E20F222B03CD91184F7D0FB5281523EC846667B9FB935D50E9FF7C5C2\`; its native build directory was \`C:\\BUKLOD_V26_LOCAL_AAB\\android\\app\\build\\outputs\\bundle\\release\\app-release.aab\`. The exact source SHA and runtime recovered from the binary remain unverified. An EAS AAB build ID must NOT be required for this native release.
- Product version `1.3.4`, Android versionCode `28`, and Expo Updates runtime `1.3.2` are separate fields. An older Git commit temporarily had runtime `1.3.4`; the runtime of an approved installed AAB must be read from the actual artifact or authoritative production build receipt, never guessed from a branch.
- The historical staging live-backend branch was 30 commits behind canonical main with 9 branch-only commits at audit. Its own obsolete staging-user OTA and APK workflows, plus the older preview APK workflow on `dev/staging-user-apk-build-20261101`, were retired to block a stale replacement.
- A new fail-closed `assertApprovedV28BinaryBaseline` gate in the staging mirror `parity` path blocks future release attempts until the actual locally built V28 AAB bytes can be SHA-256 checked in CI, its exact native source SHA and embedded runtime are identified, and a comparison against the chosen staging source is documented. It also rejects native input changes between the approved AAB source and chosen mirror source.
- Do not recreate or publish the old staging APK, reuse the diverged staging OTA branch, or assert on-device visual parity until the real V28 AAB is identified and the installed staging package/update ID is checked.

**No production changes are included in this correction; existing already-published OTA remains online.** The new gate protects future runs but cannot retroactively revoke an OTA already published. The owner-approved V28 binary provenance remains the release blocker.

---

# BUKLOD Staging Production Mirror — 2026-11-06

## Exact sources
- Production/native APK baseline: main `8e1956e617a65b3350b3fba81597fc86604da4a1` (same source as latest verified Android production OTA).
- Staging-only Wall OTA: frozen candidate `804cb557177621593d0526f7484ae57013e021eb`, full descendant of the main baseline.
- Historical staging APK: EAS `d07df683-4c2c-461b-9741-55ffb38c1b04` built Nov 1 from older source `35431cd625bd817b80cf2e1462103e3ce37aca5c`.
- Historical staging OTA: Nov 5 workflow `41967888541` from old diverged source `b1d9e8b857955bedb24e8358eee55d4b7beee98c`.

Although Git source hashes for app icon and splash assets matched, old staging code is missing newer production features. OTA cannot replace native icons already embedded in an installed APK. Install the new mirror APK to replace the outdated native baseline.

## Intentional staging-only native differences
- Android package `org.mzbministry.buklod.staging` vs production package `org.mzbministry.buklod`
- Launcher label `BUKLOD Staging` vs `BUKLOD` to prevent wrong-app identification
- Staging Android versionCode `2` supersedes old staging build code `1`; production retains code `28`
- OTA channel `staging-user` vs production channel `production`; both use project ID `23dad7d0-389a-406e-8dec-08965dab85d8` and runtime `1.3.2`
- Same production Firebase project, with separate registered staging Android client; test AdMob App ID and no live-ad requests on staging

All UI/feature source, logos, adaptive icons, splash assets, dependency versions, production-connected Supabase backend and JS runtime environment must match production exactly before the Wall RC delta is introduced. This connects to LIVE DATA: do not create destructive test records.

## Fail-closed execution
1. Verify exact main and candidate SHAs, candidate ancestry, and that current canonical main has not moved.
2. Use isolated temporary checkouts; preserve main and RC refs unchanged. Apply staging-only package/version/EAS overrides in temporary workspaces, never commit them to canonical source.
3. Verify branding hashes, package dependencies, runtime, Expo project, channel-to-branch mapping and original backend public key. Run engineering scope, focused regressions and TypeScript before spending build credits.
4. Build a signed staging APK from the canonical production baseline using EAS production *environment* (live backend) but staging-user OTA *channel*.
5. Only if the APK build succeeds, publish the exact Wall RC to Android staging-user, and verify the EAS update group and runtime.
6. Record EAS build ID and APK URL, frozen RC SHA, OTA group/update IDs and branch/channel. Physical-device acceptance is waived, not falsely reported as passed.

Never publish to the production OTA channel, modify production APK/AAB, run DB mutations, or merge old staging branches. Older staging-user clients may also receive the compatible OTA; only a newly installed staging mirror APK removes the stale native APK baseline.
