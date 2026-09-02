# BUKLOD v11 — Staging Deployment Runbook

This version converts the earlier starter SQL files into a real Supabase CLI migration
layout and prepares the app for an installable Android staging build.

It does **not** contain your Supabase/Expo credentials and therefore cannot create or
link the hosted projects by itself.

## Architecture

Production and staging should be separate.

STAGING:
- App name: `BUKLOD Staging`
- Android package: `org.mzbministry.buklod.staging`
- iOS bundle ID: `org.mzbministry.buklod.staging`
- EAS environment: `preview`
- Supabase: separate staging project
- data: disposable/test data only

PRODUCTION:
- App name: `BUKLOD`
- Android package: `org.mzbministry.buklod`
- iOS bundle ID: `org.mzbministry.buklod`
- EAS environment: `production`
- Supabase: separate production project

Expo's current multiple-variant guidance requires different Android application IDs and
iOS bundle identifiers when you want variants installed side-by-side.

---

## A. Local Supabase Validation

Install Docker-compatible runtime and the Supabase CLI, then from this project:

```bash
supabase start
supabase db reset
supabase test db
```

Canonical schema migrations are now in:

`supabase/migrations/`

Starter/test content is now isolated in:

`supabase/seed.sql`

`supabase db reset` rebuilds the local database from the migration chain and then loads
the local seed.

---

## B. Create a Hosted STAGING Supabase Project

In Supabase, create a dedicated project for staging. Do not point preview builds to the
future production database.

Copy:
- Project URL
- Publishable API key
- Project reference from the Dashboard URL

For a current Supabase client, use the publishable key in the Expo app. Secret keys are
for trusted server-side components and must never be placed in `EXPO_PUBLIC_*`.

---

## C. Link and Push Migrations

Linux/macOS:

```bash
./scripts/link-staging-supabase.sh YOUR_PROJECT_REF
```

Windows PowerShell:

```powershell
./scripts/link-staging-supabase.ps1 -ProjectRef YOUR_PROJECT_REF
```

The helper stops after:

```bash
supabase db push --dry-run
```

Review the output.

For a brand-new staging project, then run:

```bash
supabase db push --include-seed
```

Supabase documents `--include-seed` for fresh dev/staging workflows and specifically
warns against using seed data on production.

For production later, use plain:

```bash
supabase db push --dry-run
supabase db push
```

without the staging seed.

---

## D. Deploy Edge Functions

```bash
./scripts/deploy-staging-functions.sh
```

or PowerShell:

```powershell
./scripts/deploy-staging-functions.ps1
```

This deploys:
- `push`
- `delete-account`

If Expo enhanced push security is enabled, put `EXPO_ACCESS_TOKEN` into Supabase Edge
Function secrets, not the app.

---

## E. Configure Push Webhook

In the staging Supabase Dashboard create the database webhook required by v4:

Source:
- table: `public.notifications`
- event: INSERT

Destination:
- Edge Function: `push`

Authenticate the webhook using the current protected Supabase server-to-server method.

Do not put the secret credential in Expo source.

---

## F. Link Expo / EAS

Install/login:

```bash
npm install --global eas-cli
eas login
eas whoami
eas init
```

EAS Build is available with an Expo account and handles the hosted build process.

The v11 `eas.json` explicitly maps:
- development → EAS `development`
- preview/staging → EAS `preview`
- production → EAS `production`

---

## G. Add Preview Environment Variables

The preview EAS environment needs:

`EXPO_PUBLIC_SUPABASE_URL`
- value: staging project URL
- safe for client/public exposure

`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- value: staging publishable key
- this is also client-readable by design; do not substitute a secret key

`EAS_PROJECT_ID`
- EAS project UUID if required by your app config after linking

Example command pattern from current Expo EAS environment-variable tooling:

```bash
eas env:set \
  --name EXPO_PUBLIC_SUPABASE_URL \
  --value https://YOUR-STAGING.supabase.co \
  --environment preview \
  --visibility plaintext
```

For the publishable key, `sensitive` visibility can reduce accidental log exposure even
though any value embedded in client code must still be treated as public:

```bash
eas env:set \
  --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  --value sb_publishable_REPLACE_ME \
  --environment preview \
  --visibility sensitive
```

Expo currently provides `development`, `preview`, and `production` EAS environments and
lets a build profile select one using the `environment` field.

For local work, copy:

`.env.staging.example` → `.env.local`

and fill only staging public values.

---

## H. Bootstrap the First Administrator

Because role changes are intentionally restricted to an existing System Admin, use the
one-time bootstrap procedure:

1. Register the intended first staging admin through the app.
2. Open `scripts/BOOTSTRAP_FIRST_ADMIN.sql`.
3. Replace the placeholder email.
4. Run it in the staging Supabase SQL Editor.
5. From then on, assign roles through the protected BUKLOD admin workflow.

---

## I. First Android Preview Build

Make sure `.env.local` contains the staging values for local validation, then run:

```bash
node scripts/staging-gate.mjs
```

After EAS Preview variables are configured:

```bash
eas build --platform android --profile preview
```

or:

```bash
./scripts/first-android-preview.sh
```

EAS internal distribution gives the team an installable build URL. On Android the
preview build is intended to be directly installable for the pilot.

The staging build is deliberately a different package ID, so it can coexist with the
eventual production BUKLOD app on the same device.

---

## J. First Pilot Execution

Before inviting real members:

1. Use `qa/STAGING_TEST_USERS.md`.
2. Create disposable accounts only.
3. Run every P0 case in `qa/TEST_MATRIX.csv`.
4. Run:
   - `npm test`
   - `supabase test db`
   - Maestro smoke tests
5. Test account deletion.
6. Test reflection/prayer privacy with multiple accounts.
7. Test cross-church denial.
8. Test System Admin privilege boundaries.
9. Test offline/reconnect.
10. Complete `qa/UAT_SIGNOFF.md`.

Do not enter real confidential pastoral notes during technical staging.

---

## What v11 still cannot do automatically

The package cannot create your hosted Supabase or EAS project without the organization
account/credentials. It also cannot manufacture the verified MZB privacy/DPO details
still required by the v9 release gate.

Those are intentionally external/manual gates.
