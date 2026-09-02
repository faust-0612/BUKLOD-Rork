# Upgrade v8 → v9

1. Run `supabase/14_production_hardening.sql`.
2. Deploy:
   `supabase functions deploy delete-account`
3. Replace/add the v9 `src/` files.
4. Install:
   `npx expo install @react-native-community/netinfo expo-splash-screen`
5. Keep the v8/v4 dependencies already required.
6. Configure EAS with `eas init`.
7. Set the EAS project ID in the build environment.
8. Review and replace every `[REQUIRED BEFORE LAUNCH]` privacy placeholder.
9. Test required-policy gating with a fresh member account.
10. Test Data Rights request submission.
11. Test account deletion with a disposable test user.
12. Test content reporting and admin moderation.
13. Build a preview binary and verify the icon/splash.

Do not run deletion tests using the only system-admin account.
