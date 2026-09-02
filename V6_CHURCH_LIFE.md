# BUKLOD v6 — Church Life System

BUKLOD v6 connects the devotional/disciple journey to actual local-church life.

## Member features

### Church Life
- upcoming event calendar/list
- church/group/system event visibility
- event details
- RSVP: Going / Maybe / Not Going
- local church announcements
- pinned and priority announcements
- announcement read tracking
- my ministries
- serving schedule
- ministry assignment confirmation/decline

### Attendance
Two supported workflows:

1. **Leader-recorded attendance**
   - Present
   - Late
   - Excused
   - Absent

2. **Member self check-in**
   - event manager enables a time-limited check-in window
   - server generates a 6-digit event code
   - member enters the code
   - attendance is recorded as present/late

The check-in code is convenience-level attendance verification, not high-security identity
proof. For high-stakes attendance use cases, leaders should still verify presence.

## Admin / leadership features

- create system, church, or BUKLOD-group events
- event types: worship, prayer, Bible study, discipleship, fellowship, training,
  outreach, meeting, conference, other
- manage attendance
- enable self check-in
- create local ministries
- create announcements
- create service assignments through the database RPC foundation
- event reminder queue foundation

## Ministry system

Tables:
- `ministries`
- `ministry_members`
- `event_service_assignments`

A service assignment can be:
- assigned
- confirmed
- declined
- completed

Members see their own assignments; authorized event/ministry managers see assignments
within their scope.

## Event reminders

`queue_upcoming_event_reminders(hours_ahead)` creates in-app notification records for
visible upcoming events while avoiding duplicate reminder rows within a 48-hour window.

After staging review, schedule it with Supabase Cron/server-side scheduling. Supabase's
hosted platform supports Cron/pg_cron for recurring jobs; keep scheduler credentials and
server secrets outside the mobile/web client.

## Security improvements included

v6 also corrects two v5 permission issues:

1. Ordinary authenticated clients no longer have permission to select
   `quiz_choices.is_correct`.
2. Direct authenticated updates to assignment review state are revoked; assignment
   workflow remains RPC-controlled.

All new client-exposed tables have RLS enabled. This follows the Supabase architecture
used throughout BUKLOD: database-side policies remain the actual authorization boundary,
rather than trusting UI visibility alone.
