# Upgrade v12 → v13

1. Apply:
   `supabase/16_launch_content_support.sql`

Canonical migration:
`supabase/migrations/20260810011100_launch_content_support.sql`

2. On staging, load/update:
   `supabase/16_launch_content_seed.sql`

For a fresh staging environment this is already appended to `supabase/seed.sql`.

3. Replace/add the v13 `src/` files.

4. Restart or rebuild the staging app.

5. Test:
   - Home → Pilot Guide
   - Home → Quick Actions
   - Pilot Checklist
   - Support Center
   - Send Feedback
   - Admin → Pilot Operations → Launch Content
   - Admin → Pilot Operations → Tester Checklist Progress

6. Confirm the seven-day pilot devotional series has the intended dates before opening
the pilot.

## Existing v12 staging

If `supabase/seed.sql` was already applied earlier, do not blindly re-seed everything on
a shared staging database. Apply the v13 schema migration, then review/run
`16_launch_content_seed.sql` deliberately in staging.
