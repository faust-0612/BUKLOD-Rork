# Upgrade v4 → v5

If v4 is already installed:

1. Run `supabase/07_discipleship_learning.sql`
2. Optionally run `supabase/08_learning_seed.sql`
3. Replace/add the v5 `src/` files.
4. Restart Expo.
5. Log in as system_admin:
   - Admin → Learning Tracks
   - Admin → Mentor Assignments
6. Test a separate member account:
   - Learn → Start Track
   - Complete reading/reflection lesson
   - Submit assignment
7. Test a mentor account:
   - Me → Mentor Dashboard
   - Review assignment
8. Confirm a fully completed track creates a certificate record.

If starting from scratch, run SQL files 01 → 08 in order.
