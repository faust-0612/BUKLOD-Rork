# BUKLOD v3 — Admin & Content Management

## Global System Admin

The v3 admin dashboard is an Expo Router route, so the same admin experience can run
inside the native app and on Expo web.

### Dashboard
- total active profiles
- devotional completions today
- system completion rate
- active BUKLOD groups
- active local churches
- pending membership requests
- published/available devotionals
- devotional series count

### Devotional CMS
- create devotional series
- publish/unpublish a series
- create a devotional
- edit an existing devotional
- assign series + day number
- set publish date
- draft vs publish/schedule
- Scripture
- Reflection
- Think About It
- Live It Today
- Prayer
- Discussion Question

A devotional with `is_published = true` and a future `publish_date` is treated as
scheduled because member queries only surface devotionals whose publish date has arrived.

### Organization
- create local churches
- create BUKLOD groups
- optional group-leader assignment
- membership approvals
- manage users and roles
- activate/deactivate user profiles

## Permission model

- Global devotional authoring: `system_admin` only.
- Church creation: `system_admin` only.
- User role changes: `system_admin` only.
- User account activation/deactivation: `system_admin` only.
- Group creation/leader assignment: `system_admin`, or pastor/local admin in own church.
- Membership approval remains governed by v2 onboarding rules.

All privileged RPCs write an audit-log record where applicable.

## Important deployment note

The mobile/web frontend must use only the Supabase publishable key. Never bundle a
Supabase secret/service-role key into Expo or browser code. RLS remains enabled on
client-exposed tables.
