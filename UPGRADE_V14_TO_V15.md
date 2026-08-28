# Upgrade v14 → v15

v15 introduces no new production database tables or migrations.

The canonical production migration count remains 13.

New release/cutover files are added around the v14 application/database:

- `supabase/seed.staging.sql`
- `supabase/seed.production.sql`
- `scripts/production-preflight.mjs`
- `scripts/verify-production-migrations.mjs`
- `scripts/production-cutover.*`
- `scripts/build-production-release.*`
- `scripts/BOOTSTRAP_FIRST_PRODUCTION_ADMIN.sql`
- `production/*`
- `store/*`
- `release/*`
- `qa/FINAL_PRODUCTION_SIGNOFF.md`

Before using v15 for a real launch, replace the v9 privacy placeholders with verified
organization information. The production preflight intentionally refuses to pass until
that is done.
