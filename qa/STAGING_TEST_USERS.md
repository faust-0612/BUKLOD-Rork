# Staging Test Users — Actual Setup Order

Do not use real pastoral/member private data for the first test cycle.

## Step 1 — Seed staging

Push migrations with the staging seed so the app has the initial MZB church selector
and starter content.

## Step 2 — Register First System Admin

Register through the normal app registration screen using a disposable QA email.

Then run:

`scripts/BOOTSTRAP_FIRST_ADMIN.sql`

in the staging Supabase SQL Editor after replacing the placeholder email.

## Step 3 — Register the Remaining QA Personas

Use separate disposable email addresses:

1. Member A — Pilot Church / Pilot Group A
2. Member B — same church and same group
3. Other Church Member — different church
4. Group Leader
5. Pastor
6. Local Admin
7. optional second System Admin QA

Approve ordinary church/group membership through the app after the first admin is active.

Use the system-admin User Management screen to assign privileged roles. Never alter the
registration UI to let a user choose Leader/Pastor/Admin.

## Step 4 — Run Privacy Matrix

Use `qa/TEST_MATRIX.csv`, especially all P0 cases:

- PRV-001 through PRV-004
- PRY-001 through PRY-002
- CARE-001 through CARE-002
- DIR-001
- ROLE-001 through ROLE-004
- RPT-001 through RPT-004

## Step 5 — Delete Disposable Accounts After Test Cycle

Test the in-app account-deletion flow with at least one ordinary disposable member.

Do not test deletion first on the only System Admin account.
