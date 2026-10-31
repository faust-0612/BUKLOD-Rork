# BUKLOD staging-user fast OTA (DEV only)

## Isolation and cost controls
- The staging-user release APK is a standalone Android package: `org.mzbministry.buklod.staging`.
- Its native Expo Update channel is `staging-user`. The client enables fast checks ONLY when `Updates.channel === 'staging-user'`; production remains on the existing conservative behavior.
- NEVER use `scripts/BUILD_DEV_APK.ps1` or the `dev-apk` build profile for staging: they inherit the production package and channel.
- Do not trigger paid EAS Build or GitHub Actions jobs until the preflight gates pass; a new staging Supabase project may incur additional compute cost.

## Required preflight BEFORE first build or staging update
1. Provision or identify an explicitly authorized, non-production Supabase project. Never point staging to `yhanxndaqbmuzbdqlblu` (BUKLOD Connect production) or reuse unrelated production projects.
2. In the EAS **preview** environment, configure `APP_VARIANT=staging`, `EXPO_PUBLIC_APP_ENV=staging`, `EXPO_PUBLIC_SUPABASE_URL` (isolated staging URL), and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (staging public key). Do not put a service-role or `sb_secret_` key in an app.
3. Ensure `BUKLOD_STAGING_PROJECT_REF` corresponds to the isolated URL when running the CI staging gate. Confirm compatible schema and required native Firebase staging configuration.
4. Run `npm run staging:gate` and focused app checks. Investigate gate failures; do not bypass them. Verify the build/update resolves the same preview environment and the intended runtime.
5. Verify `eas channel:view staging-user` points to the intended isolated staging branch; do not modify the production channel.

## First installable APK (one build, once prerequisites pass)
```sh
eas build --platform android --profile staging-user --non-interactive
```
Install the resulting APK alongside the regular BUKLOD app. An existing staging APK must have a matching Expo runtime to receive an OTA. Current Main runtime is `1.3.2`.

## Future DEV JS/assets-only iteration (no new APK needed)
From a reviewed DEV commit with the staging preflight passing:
```sh
eas update --channel staging-user --platform android --environment preview --message "BUKLOD DEV staged fixes" --non-interactive
```
EAS Update uses EAS **preview** variables, not `eas.json` build profile `env` values: check `APP_VARIANT`, `EXPO_PUBLIC_APP_ENV`, and staging backend before EVERY publish.

After publishing:
1. Open **BUKLOD Staging** and tap **Check update**, or return to the app foreground to trigger a throttled check.
2. On a downloaded update, tap **Apply update** and confirm **Restart staging** after saving edits, finishing calls/PTT, and completing uploads.
3. Confirm the changed behavior on a real Android device, including offline/error cases. No silent reload is permitted.
4. Only then prepare a separately frozen, verified RC for the manual Production OTA. Do not auto-promote an update built with staging-only API keys.

The automatic staging foreground check is rate-limited to one request per 60 seconds with a 30-second failure cooldown; manual taps have an 8-second anti-spam cooldown. This is *not* constant polling and is not guaranteed instant delivery under weak or unavailable networks.

## Evidence as of 2026-11-01
The fast OTA code and contract test are committed on `dev/staging-user-fast-ota-20261101`. No paid EAS build, staging OTA, main merge, or Production OTA was performed by this change. Separate staging backend and EAS preview credentials remain to be verified before build/release.

## Cloud-only manual build workflow
The protected workflow is `.github/workflows/staging_user_android_apk.yml` on the DEV branch. It has only `workflow_dispatch`, checks the GitHub repository's `EXPO_TOKEN` secret and `BUKLOD_STAGING_PROJECT_REF` variable, runs the staging gate with the EAS Preview environment, and starts exactly one EAS Android `staging-user` build if all gates pass. This workflow never promotes or updates the production channel. It is NOT auto-triggered by code pushes. A GitHub Actions run or EAS build is not evidence of success until EAS returns a completed APK artifact.
