# BUKLOD 1.0 — First Android Release Execution

This is the v16 Android-first execution path.

The safest initial Google Play path is:

Production AAB
→ upload to Google Play as a draft/internal-test release
→ verify store/install behavior
→ only then decide whether to promote toward public production.

## Phase A — Accounts and store prerequisites

Before the first submission:

1. Expo/EAS account is connected to this project.
2. Google Play Developer account exists.
3. `BUKLOD` app exists in Google Play Console.
4. Android package is:
   `org.mzbministry.buklod`
5. Google Service Account credentials for Play submission are uploaded to EAS.

Current EAS CLI path for Android service credentials:

```bash
eas credentials --platform android
```

Choose the production build profile and configure the Google Service Account when
prompted.

## Phase B — Configure production EAS environment

Run:

```bash
./scripts/configure-production-eas.sh
```

or on Windows:

```powershell
.\scripts\configure-production-eas.ps1
```

This writes:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `EAS_PROJECT_ID`

into the EAS `production` environment.

Verify the values in the EAS dashboard before building.

## Phase C — Production database

Link production:

```bash
./scripts/link-production-supabase.sh YOUR_PROJECT_REF
```

It performs a migration dry-run only.

Then complete the reviewed v15 cutover flow:

```bash
./scripts/production-cutover.sh
```

and only after approval:

```bash
./scripts/production-cutover.sh --apply
```

Do not apply staging seed data.

## Phase D — Keep Maintenance Mode ON

After migration:
- bootstrap the first production System Admin
- add verified live church records
- apply the production-safe baseline
- deploy Edge Functions
- configure notifications webhook

Do not open ordinary member access yet.

## Phase E — Build the Android production AAB

Current Expo production build command:

```bash
eas build --platform android --profile production
```

The production profile should generate an Android App Bundle (`.aab`) suitable for
Google Play.

Do not use the preview APK as the production-store artifact.

## Phase F — Register exact build

When EAS finishes:
1. Record EAS build URL/ID.
2. Open BUKLOD:
   Admin → Go-Live Command Center → Release Candidates.
3. Register:
   - Version: 1.0.0
   - Build label
   - Platform: Android
   - Build/install URL or EAS reference
4. Keep status `testing` until smoke/UAT evidence is complete.

## Phase G — First Google Play upload: DRAFT

v16 adds EAS submission profile:

`google-play-draft`

Run:

```bash
eas submit --platform android --profile google-play-draft
```

Select the exact production build.

This is intentionally configured with:

`releaseStatus: draft`

so the release still requires manual action in Google Play Console.

For a brand-new Google Play app, EAS Submit's default first-release behavior is the
internal testing track. The app still needs Play Console setup/listing work before it
can be promoted beyond testing.

## Phase H — Optional internal-test release

Only when you intentionally want the build available to Google Play internal testers,
v16 also provides:

`google-play-internal`

Run:

```bash
eas submit --platform android --profile google-play-internal
```

That profile explicitly uses:
- `track: internal`
- `releaseStatus: completed`

Do not use it until the tester list and store configuration are ready.

## Phase I — Google Play Console

Complete/review:
- app access instructions
- privacy policy URL
- Data Safety
- content rating
- target audience
- contact/support information
- store listing
- screenshots
- account deletion information
- internal testing list

EAS Submit uploads the binary; it does not replace the need to finish the Google Play
listing and policy forms.

## Phase J — Android production smoke test

Keep BUKLOD Maintenance Mode ON for ordinary users.

Run `qa/ANDROID_PRODUCTION_SMOKE_TEST.md`.

At minimum test:
- production app identity
- login
- registration
- approval
- devotional
- reflection privacy
- prayer privacy
- cross-church boundaries
- notification
- account deletion with approved disposable account
- System Admin
- Go-Live Command Center

## Phase K — Final decision

Required:
- exact Android candidate approved
- zero P0
- required readiness checks passed
- privacy/store declarations complete
- support + rollback owner ready

Record the human decision in Command Center.

Only after GO LIVE:
- disable production Maintenance Mode
- begin controlled rollout
- monitor the first 24 hours.
