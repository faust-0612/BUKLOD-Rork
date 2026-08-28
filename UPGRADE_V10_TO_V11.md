# Upgrade v10 → v11

v11 does not add a new application database feature. It makes the project deployable
through the current Supabase CLI/EAS staging workflow.

## New canonical Supabase layout

Schema migrations:
`supabase/migrations/*.sql`

Staging/local seed:
`supabase/seed.sql`

CLI config:
`supabase/config.toml`

The original numbered SQL files are retained as readable historical/source files.

## New environment separation

Preview/staging uses:
- `BUKLOD Staging`
- `org.mzbministry.buklod.staging`
- EAS `preview`
- separate staging Supabase project

Production remains:
- `BUKLOD`
- `org.mzbministry.buklod`
- EAS `production`
- separate production Supabase project

## Next commands

Read:

`V11_STAGING_DEPLOYMENT.md`

Then complete local DB validation before linking any hosted project.
