# BUKLOD Kingdom Native Lab — separate Android APK identity

## Authority and outcomes
This is a **third experimental package**, **not a staging-user OTA or a Play production update**. It includes the zero-asset procedural Godot 3D game, an Android-native Gboard GIF receiving EditText, and the existing Android Storage Access Framework's Google Drive/Files provider picker. None of these require buying assets or subscribing to a Drive API.

- Android package: `org.mzbministry.buklod.kingdomlab`
- Runtime: `1.4.0-kingdom-native-lab.1`
- Channel: `kingdom-native-lab` (**updates.enabled=false**; no OTA until explicitly authorized)
- EAS profile: `kingdom-native-lab` / **APK**, separate from `staging-user`, `staging-dev` and `production`
- Backend: lab-only `.invalid` Supabase URL; **no real account, posts, ads, push, analytics, PTT, financial changes or backend connections**. Root layout excludes all normal BUKLOD providers and hosts in lab mode.
- Lab route: `/kingdom-native-lab`; 3D opens a separate non-exported Godot Android Activity/process; Gboard GIF and Google Drive file both create **local previews only**, with no public Send.
- Original BUKLOD: main `org.mzbministry.buklod`, existing staging `org.mzbministry.buklod.staging`, both runtime `1.3.2`, remain on their established releases and channels. Normal layout/main route unaffected.

## Build blockers and safe resolution
No Android APK was built, installed or published in this implementation session. For a **real** isolated build, generate/register a **new Firebase Android client** for `org.mzbministry.buklod.kingdomlab` and obtain its **own** `google-services.json` under a noncanonical path, then configure `KINGDOM_LAB_GOOGLE_SERVICES_FILE`. Do **not** point at the staging/user or production Firebase file. For EAS, register a **separate** project and set `KINGDOM_LAB_EAS_PROJECT_ID` to that distinct UUID. The build gate will reject reuse of the existing main or Classroom project IDs. These are genuine external registration/credential blockers and must not be silently substituted or fabricated.

The no-cloud-cost **local** Android debug build requires installed Android SDK/JDK, local `node_modules`, Gradle dependencies and this exact DEV branch:
```sh
node --test tests/kingdom-native-lab-isolation-20261114.test.mjs
node --test tests/kingdom-godot-zero-assets-20261114.test.mjs
node --test tests/kingdom-zero-cost-living-world-20261114.test.mjs
node --test tests/kingdom-zero-cost-village-diorama-20261114.test.mjs

# Only from dev/kingdom-native-lab-isolated-20261114 in an isolated checkout:
export KINGDOM_LAB_GOOGLE_SERVICES_FILE=./google-services.kingdomlab.json
export KINGDOM_LAB_EAS_PROJECT_ID=<distinct-new-project-id>
bash scripts/kingdom-lab/build-local.sh
```
No automatic GitHub Action, EAS cloud build, OTA, Play submission, database migration or remote deployment was triggered by this change. A local build may download official Godot Maven AAR and normal build dependencies, using internet bandwidth but not any paid asset or hosted game backend.

## Visual/behavioral acceptance before distributing
1. Verify installed package ID is the unique `kingdomlab` ID and coexists alongside existing staging/user and Play production on Android.
2. Open 3D, test 13 locations, local supplies/build, pinch/drag interactions, memory, worker FPS and background/return.
3. Open Gboard GIF in focused native comment field, ensure GIF appears instantly in preview without share-target activity, then clear/preview; no send.
4. Open Google Drive under Android Files picker, choose allowed GIF/image, verify animated GIF survives import and image remains local; deny/cancel and large-file scenarios.
5. Ensure no real user/account, live DB, ads, PTT, push, Stream, or notifications; confirm no Supabase real host requests.
6. Verify old staging-user and production exact installed package IDs, runtime signatures, navigation and logs independently; **do not uninstall/replace either**.
7. After verifying the exact source commit and APK, freeze a separate lab RC. Do not use staging-user, main production channels, or Play until owner authorization.

## Scope caveats
**Google Drive:** this is the Android system document provider integration, not Drive REST OAuth synchronization or automatic cloud backup. A user must explicitly select each file, and Drive must be available in the Android picker. This avoids extra OAuth scopes, quotas and token handling.

**Keyboard GIF:** custom native focused text input accepts MIME image/gif through `InputConnectionCompat` and `ViewCompat.setOnReceiveContentListener` and stages a validated GIF in app private cache. Live posting is deliberately disabled in offline lab. Later transfer to actual BUKLOD staging requires independent native rebuild and permissions/reward tests.

**Godot:** 4.7.2.stable Maven Android library; a deterministic ZIP source pack is created locally at prebuild. Actual Godot headless parser, Java/Kotlin compile, Android install, Play/OTA are **not yet verified**, so the prototype must not be called a release.
