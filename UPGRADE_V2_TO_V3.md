# Upgrade v2 → v3

If v2 is already installed:

1. Keep the existing Supabase database.
2. Run:
   `supabase/05_admin_cms.sql`
3. Replace/add the v3 `src/` files.
4. Restart Expo.
5. Log in using a `system_admin` account.
6. Open **Me → OPEN BUKLOD ADMIN**.
7. Test in staging before production.

If starting from scratch, run SQL files 01 → 05 in order.
