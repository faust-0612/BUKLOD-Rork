# BUKLOD DATA & ACCESS MODEL

```text
AUTH.USER
   │
   └── PROFILE ─────────────── CHURCH
         │                        │
         │                        └── BUKLOD_GROUP
         │                              │
         └──────── GROUP_MEMBERSHIP ────┘

DEVOTIONAL_SERIES
   └── DEVOTIONAL
         ├── COMPLETION
         └── REFLECTION (privacy)

PROFILE
   ├── PRAYER_REQUEST
   │      └── PRAYER_RESPONSE
   ├── COMMUNITY_POST
   │      ├── COMMENT
   │      └── REACTION
   ├── FOLLOW_UP
   ├── NOTIFICATION
   └── DEVICE_TOKEN
```

## Access principles

- Member: own profile, published devotionals, own completion/reflection records,
  and community/prayer content visible to their group/church.
- Leader: member privileges + members in managed group, engagement data, and
  reflections/prayers shared to the leader/group.
- Pastor/local_admin: church-level management and monitoring.
- System admin: system-wide management.
- Private reflections remain private from ordinary leadership access.
- The mobile client uses only the Supabase publishable key.
- Server-only jobs should use a protected backend/Edge Function, never a
  service-role key embedded in the app.
