# Upgrade v3 → v4

1. Keep your existing v3 Supabase project.
2. Run `supabase/06_realtime_notifications.sql`.
3. Copy/replace the v4 `src/` folder.
4. Install:
   `npx expo install expo-notifications expo-constants`
5. Add `expo-notifications` to the Expo config plugins.
6. Configure the EAS project ID.
7. Deploy `supabase/functions/push`.
8. Create the notifications INSERT database webhook.
9. Configure Android FCM and iOS APNs credentials through EAS.
10. Use a development build / production build for push testing.
11. Test every privacy level with separate accounts.
12. Only after staging tests, schedule daily devotional reminder queueing.
