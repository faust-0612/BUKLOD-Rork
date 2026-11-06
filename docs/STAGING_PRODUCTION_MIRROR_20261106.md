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
