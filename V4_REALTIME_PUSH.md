# BUKLOD v4 — Realtime Community, Prayer, Push & Follow-up

## What v4 adds

### Real-time BUKLOD community
- member post composer
- categories: reflection, testimony, encouragement, prayer update
- post detail / conversation
- comments
- reactions: Amen, With You, Praying
- live refresh via Supabase Realtime Postgres Changes

For v4, Postgres Changes is deliberately used for easy deployment. Supabase currently
recommends **Broadcast** for better scalability and security at larger scale. Before a
large public rollout, migrate high-volume community channels to Broadcast.

### Complete prayer journey
- create prayer request
- privacy: private / leader / group / church
- prayer wall
- "I Prayed" responses
- live prayer updates
- prayer-response notifications
- leader notification for leader/group-visible prayer requests
- owner can mark prayer as answered
- optional answered-prayer testimony

### Notification Center
- persistent in-app notifications
- unread count
- mark one/read all
- notification deep links
- live notification updates

### Expo push notifications
Client:
- requests permission
- obtains ExpoPushToken using EAS `projectId`
- saves token to `device_tokens`
- handles foreground notification events
- handles notification taps / deep links

Server:
- Supabase Database Webhook on `notifications INSERT`
- Supabase Edge Function `push`
- sends to Expo Push Service
- optional `EXPO_ACCESS_TOKEN` for Expo enhanced push security

### Pastoral follow-up
- automatic engagement status calculation:
  - active
  - check-in
  - follow-up
  - attention
- configurable day thresholds
- leader member engagement dashboard
- create caring follow-up
- member receives check-in notification
- leader records contact/action/notes
- contacted / awaiting response / completed states

These are participation signals only. BUKLOD must never describe them as a member's
spiritual worth or holiness score.

## Expo dependencies

Install:

```bash
npx expo install expo-notifications expo-constants
```

Push notifications require proper native credentials and a development/production
build. Do not expect remote push notification testing to work in Expo Go.

Use `app.config.example.json` as a reference and replace the EAS project UUID.

## Supabase setup

Run:

```text
supabase/06_realtime_notifications.sql
```

Deploy the Edge Function:

```bash
supabase functions deploy push
```

If using Expo enhanced push security:

```bash
supabase secrets set EXPO_ACCESS_TOKEN=YOUR_EXPO_ACCESS_TOKEN
```

Then create a **Database Webhook**:

- Table: `public.notifications`
- Event: `INSERT`
- Destination: Supabase Edge Function
- Function: `push`
- Method: POST
- Add auth header with a secret/service key as instructed by Supabase's webhook UI

The service/secret key belongs only in the protected server/webhook environment.
Never place it in the Expo app or browser bundle.

## Daily reminder scheduling

`queue_daily_devotional_reminders()` creates persistent notification rows for members
who have not completed the current devotional and who allow devotional reminders.

After staging tests, schedule that function once daily using a trusted Supabase
server-side scheduler/Cron workflow at your desired Philippine local time.

## Production scaling note

v4 uses Postgres Changes because it is simpler to set up. Supabase currently recommends
Broadcast for most scalable database-change subscriptions. Treat this implementation as
a good MVP/early-production foundation, not the final architecture for a very large
multi-church deployment.
