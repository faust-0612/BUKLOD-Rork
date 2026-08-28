# BUKLOD v15 — Production Cutover Runbook

v15 is the final 1.0 production-cutover package built on top of the v14 Command Center.

The package still does not contain real organization credentials, privacy contact
details, app-store accounts, or hosted Supabase/EAS credentials.

## 1. Freeze the release candidate

Before touching production:

- staging Command Center shows zero unresolved P0
- required readiness checks have real evidence
- exact Android/iOS candidate is registered
- final Privacy Notice is verified
- staging pilot decision is READY FOR FINAL SIGNOFF or an equivalent authorized decision
- release candidate version is 1.0.0

Do not continue modifying application code after this point without creating a new
release candidate.

## 2. Create/verify the production Supabase project

Production must be separate from staging.

Confirm:
- project URL
- publishable key
- project reference
- backup settings
- Auth configuration
- production email/SMTP configuration
- CAPTCHA/rate-limit decisions
- SSL/network restrictions
- Edge Function secrets

Link only after confirming you are targeting the production project.

## 3. Configure production EAS environment

Required:

`EXPO_PUBLIC_APP_ENV=production`

`EXPO_PUBLIC_SUPABASE_URL=https://...supabase.co`

`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`

`EAS_PROJECT_ID=<verified project UUID>`

Do not use `sb_secret_` or service-role credentials in an Expo public variable.

## 4. Production preflight

```bash
node scripts/production-preflight.mjs
```

The script deliberately fails while the Privacy Notice still contains launch
placeholders.

Fix the actual verified privacy/controller details before proceeding.

## 5. Migration dry-run

```bash
./scripts/production-cutover.sh
```

Windows:

```powershell
.\scripts\production-cutover.ps1
```

This runs:
- production preflight
- migration hash manifest
- `supabase db push --dry-run`

It does not apply migrations.

## 6. Apply production schema

After human review:

```bash
./scripts/production-cutover.sh --apply
```

Windows:

```powershell
.\scripts\production-cutover.ps1 -Apply
```

The script requires the typed phrase:

`BUKLOD-PRODUCTION`

and then runs plain:

`supabase db push`

It never runs the staging seed.

## 7. Bootstrap first production System Admin

Create the intended first production Auth user.

Review and run:

`scripts/BOOTSTRAP_FIRST_PRODUCTION_ADMIN.sql`

The script requires:
- verified production admin email
- explicit confirmation value

Do this while Production Maintenance Mode remains ON.

## 8. Add verified live churches

Review:

`production/PRODUCTION_CHURCHES_TEMPLATE.sql`

Only add churches that should actually appear in the live registration selector.

Do not automatically copy QA or pilot church rows.

## 9. Apply production-safe baseline

Review:

`supabase/seed.production.sql`

This keeps production in Maintenance Mode and does not add pilot/demo data.

## 10. Deploy server functions

```bash
supabase functions deploy push
supabase functions deploy delete-account
```

Configure:
- Edge Function secrets
- notifications INSERT webhook
- push credentials
- any SMTP/Auth production settings

## 11. Production smoke test while Maintenance Mode is ON

System Admin bypass allows administrative testing.

Verify:
- login
- church setup
- registration
- onboarding approval
- devotional visibility
- reflection privacy
- prayer privacy
- community scope
- learning
- events/church life
- admin access
- notifications
- privacy request workflow
- account deletion with an approved disposable test user only
- Command Center

## 12. Production binary

```bash
./scripts/build-production-release.sh
```

or equivalent EAS commands.

Register the exact successful build in:
Admin → Go-Live Command Center → Release Candidates.

## 13. Store submission / distribution

Complete the appropriate store checklists under `store/`.

Store privacy declarations must match actual BUKLOD behavior and actual third-party
processors.

## 14. Final Command Center decision

Required:
- zero open P0
- required readiness gates pass
- exact release candidate approved
- support/rollback owner ready
- written human rationale

Record:
`GO LIVE`

Only then disable Production Maintenance Mode.

## 15. First 24 hours

Monitor:
- login/registration failures
- privacy reports
- P0/P1 incidents
- deletion requests
- content moderation
- notification problems
- crash/support reports
- cross-church/group access issues

If continued use creates privacy/data-integrity risk:
- enable Maintenance Mode
- log P0 incident
- record HOLD/ROLLBACK
- follow `qa/ROLLBACK_INCIDENT_RUNBOOK.md`.
