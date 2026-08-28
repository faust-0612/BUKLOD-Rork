# BUKLOD 1.0 — Production Starter v16

A production-oriented starter for the BUKLOD devotional, discipleship, community,
monitoring, prayer, and pastoral follow-up app.

## Recommended stack

- Expo / React Native
- Expo Router + TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security (RLS)
- Supabase Realtime (later)
- Expo Notifications (later)

## 1. Create the Expo project

Use Expo's current default multi-screen template:

```bash
npx create-expo-app@latest buklod
cd buklod
```

Install Supabase dependencies:

```bash
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
```

If the generated project does not already have Expo Router configured, use Expo's
official Router installation instructions. The current default template includes
Expo Router and TypeScript.

## 2. Copy this starter into the Expo project

Copy these folders/files into the generated project:

- `src/`
- `assets/branding/`
- `.env.example` → rename to `.env`

If your generated project currently uses `/app`, move the routes to the router root
expected by that project, or configure it to use `src/app`.

## 3. Create a Supabase project

In Supabase SQL Editor run, in this order:

1. `supabase/01_schema.sql`
2. `supabase/02_rls.sql`
3. `supabase/03_seed.sql`
4. `supabase/04_onboarding.sql`
5. `supabase/05_admin_cms.sql`
6. `supabase/06_realtime_notifications.sql`
7. `supabase/07_discipleship_learning.sql`
8. `supabase/08_learning_seed.sql` (optional starter curriculum)
9. `supabase/09_church_life.sql`
10. `supabase/10_church_life_seed.sql` (optional)
11. `supabase/11_member_care_directory.sql`
12. `supabase/12_member_care_seed.sql` (optional)
13. `supabase/13_reporting_analytics.sql`
14. `supabase/14_production_hardening.sql`

Then copy your project URL and publishable key into `.env`.

## 4. Environment variables

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never put the Supabase service-role key in the mobile app.

## 5. Run

```bash
npx expo start
```

## Current starter features

- Email/password authentication
- Automatic profile creation
- Role model:
  - member
  - leader
  - pastor
  - local_admin
  - system_admin
- Churches and BUKLOD groups
- Daily devotionals and series
- Completion tracking
- Reflection + application with privacy controls
- Prayer requests and prayer responses
- Community posts/comments/reactions schema
- Follow-up records
- Announcements and notifications schema
- Leader dashboard query foundation
- Database RLS policies designed around least privilege

## Important security design

BUKLOD tracks participation, not a person's spiritual worth. Private reflections are
not visible to leaders unless the member explicitly chooses a shareable privacy level.
Prayer requests also use member-selected visibility.

The SQL uses RLS for the exposed public tables. Review all policies in a staging
Supabase project before production launch and test every role with separate accounts.

## Next implementation phases

1. Connect real devotional content management.
2. Build full registration with church/group assignment workflow.
3. Add leader messaging/follow-up UX.
4. Add Supabase Realtime for community updates.
5. Add Expo push notifications and device-token registration.
6. Add admin web dashboard and audit logs.
7. Add data export, backups, moderation, privacy policy, consent text, and account deletion.


## v2 added: registration + onboarding approval

- Dedicated Create Account screen
- Public active-church selector during registration
- All self-registered accounts default to `member`
- Pending church join request
- Pending/approved/review-needed onboarding screen
- Pastor/local-admin/system-admin approval workflow
- BUKLOD group assignment at approval
- Leader approval supported only for preassigned requests to that leader's exact group
- Atomic approval/rejection RPCs
- Automatic member notification
- Privileged audit log entry
- System-admin-only role promotion RPC
- Main tab guard until membership is approved

See `ONBOARDING.md`.


## v3 added: System Admin + Devotional CMS

- Global BUKLOD admin dashboard
- Dashboard statistics RPC
- Devotional series manager
- Devotional create/edit/schedule/publish editor
- Church creation
- BUKLOD group creation
- Controlled leader assignment
- User role administration
- User activation/deactivation
- Tightened global devotional authoring to `system_admin`
- Additional audit logging
- Native + web-compatible Expo Router admin routes

See `ADMIN_CMS.md`.


## v4 added: realtime community + prayer + notifications + follow-up

- real-time BUKLOD community posts
- real-time comments and reactions
- complete prayer request flow
- prayer privacy and answered-prayer journey
- notification center and unread counts
- Expo push token registration
- Supabase push Edge Function
- notification database-webhook architecture
- pastoral engagement statuses
- caring follow-up workflow
- configurable inactivity thresholds
- daily devotional reminder queue function

See `V4_REALTIME_PUSH.md`.


## v5 added: discipleship & learning

- Bible study / discipleship learning tracks
- New Believer and Membership track foundation
- ordered learning lessons
- reading, reflection, quiz, and assignment lesson types
- member enrollment and progress
- server-side quiz grading
- mentor-reviewed assignments
- mentor ↔ disciple assignment
- mentor dashboard
- track completion certificates
- learning milestones foundation
- system-admin learning CMS
- starter curriculum seed

See `V5_DISCIPLESHIP_LEARNING.md`.


## v6 added: Church Life

- church event calendar/list
- system/church/group event scopes
- RSVP
- attendance management
- time-limited member self check-in code
- announcements with priority/pinning/read receipts
- ministries and ministry membership
- serving assignments
- member serving schedule
- event reminder queue
- Church Life admin area
- v5 quiz-answer and assignment-update permission hardening

See `V6_CHURCH_LIFE.md`.


## v7 added: directory + households + member care + visitors

- privacy-controlled church directory
- member directory preferences
- optional mobile/birthday/household/ministry visibility
- household/family links
- important dates foundation
- pastoral member-care summary
- restricted pastoral care notes
- visitor/new member journey
- visitor consent-to-contact field
- visitor follow-up assignment
- visitor follow-up notifications
- admin Member Care area
- admin Visitors & New Members area

See `V7_MEMBER_CARE_DIRECTORY.md`.


## v8 added: Reporting & Analytics

- system / church / BUKLOD-group analytics scopes
- devotional participation overview
- daily devotional trend
- community/prayer metrics
- discipleship completion metrics
- event attendance metrics
- ministry participation
- visitor journey metrics
- open follow-up metrics
- BUKLOD group comparison
- church comparison
- member engagement CSV export
- attendance CSV export
- saved monthly report snapshots
- admin monthly reporting screen

See `V8_REPORTING_ANALYTICS.md`.


## v9 added: Production Hardening & Launch Readiness

- policy-version and acknowledgement gate
- draft BUKLOD privacy notice
- community guidelines
- pastoral-care participation notice
- data-subject request workflow
- permanent account-deletion Edge Function
- content reporting and moderation queue
- moderated prayer visibility
- network/offline awareness
- push registration retry on reconnect
- root Expo Router ErrorBoundary
- Suspense loading fallback
- custom not-found screen
- EAS build profiles
- production app config
- Expo-compatible PNG icon/splash assets
- production security gate and release commands

See `V9_PRODUCTION_HARDENING.md`.


## v10 added: QA + pilot release package

- Jest / jest-expo test scaffold
- Expo Router testing-library smoke test
- pgTAP database test suites
- RLS/privacy regression tests
- privilege-escalation tests
- Maestro E2E smoke flows
- Android/iOS EAS Workflow examples
- `e2e-test` EAS build profile
- automated release-blocker script
- manual/UAT security matrix
- defect log template
- disposable test-account template
- phased pilot rollout plan
- UAT sign-off sheet
- Expo SDK 57 bootstrap guide

See `V10_QA_PILOT.md` and `QUALITY_GATES.md`.


## v11 added: Staging deployment & first Android preview setup

- canonical `supabase/migrations/` chain
- local/staging-only `supabase/seed.sql`
- Supabase CLI `config.toml`
- migration manifest
- dedicated staging environment templates
- stronger `.gitignore`
- separate staging application/bundle identifiers
- EAS preview/development/production environment mapping
- visible `STAGING BUILD • TEST DATA ONLY` badge
- Supabase staging link/dry-run helpers
- Edge Function deployment helpers
- staging environment validator
- one-time first System Admin bootstrap SQL
- disposable staging test-user setup guide
- first Android preview build scripts/checklist
- detailed staging deployment runbook

See `V11_STAGING_DEPLOYMENT.md`.


## v12 added: Pilot Operations & Release Control

- app runtime configuration
- maintenance mode with System Admin recovery bypass
- minimum/recommended version gates
- in-app release notes
- controlled staging pilot cohorts
- pilot participant access
- system/church/group-capable feature-flag database model
- initial system-wide feature-flag admin UI
- member pilot feedback
- sanitized diagnostic metadata
- System Admin feedback queue
- feature unavailable screens
- staging seed creates `Leadership Pilot`
- v12 pgTAP tests and QA scenarios

See `V12_PILOT_OPERATIONS.md`.


## v13 added: Pilot Content & Launch Package

- polished Home quick actions
- Pilot Guide and Pilot Welcome screen
- role-aware Pilot Checklist
- pilot checklist progress for System Admin
- searchable BUKLOD Support Center
- help/privacy/pilot support articles
- admin announcement templates
- seven-day first-week pilot devotional series
- fuller New Believer Foundations starter track
- five-lesson BUKLOD Membership Course starter
- improved registration/onboarding copy
- pilot tester guide
- leader pilot guide
- support triage guide
- first-week content plan
- pilot launch-day checklist
- v13 pgTAP + QA scenarios

See `V13_PILOT_CONTENT_LAUNCH.md`.


## v14 added: Pilot Monitoring & Go-Live Command Center

- Pilot health summary
- last-7-day recorded pilot activity
- checklist coverage
- support/privacy-feedback summary
- live P0/P1/P2/P3 incident registry
- required Go-Live readiness evidence
- advisory HOLD / REVIEW / READY FOR FINAL SIGNOFF evaluation
- exact release-candidate registry
- audited HOLD / CONTINUE PILOT / GO LIVE / ROLLBACK decisions
- production cutover checklist
- rollback and incident runbook
- v14 pgTAP and UAT scenarios

Automatic crash telemetry is **not** claimed as connected. Crashes remain manual
incidents/feedback until an external crash service is actually configured.

See `V14_PILOT_MONITORING_COMMAND_CENTER.md`.


## v15 added: Production Cutover Package / BUKLOD 1.0

- staging vs production seed separation
- production-safe runtime baseline
- first production System Admin bootstrap
- production church-data template
- production environment preflight
- migration hash verification
- dry-run-first production cutover scripts
- explicit typed production confirmation
- production build helpers
- final production cutover runbook
- privacy finalization worksheet
- data-retention approval template
- support/escalation roster
- Google Play checklist
- Apple App Store checklist
- store privacy declaration worksheet
- BUKLOD 1.0 release notes
- release manifest
- final production sign-off sheet
- additional production P0 QA scenarios

See `production/PRODUCTION_CUTOVER_RUNBOOK.md`.


## v16 added: Production Deployment Execution Pack

- production EAS environment setup scripts
- production Supabase link/dry-run scripts
- Android production AAB build scripts
- Google Play draft submission profile
- Google Play internal-testing submission profile
- production Supabase settings checklist
- first Android release execution runbook
- Android production smoke-test checklist
- Google Play first-upload worksheet
- external execution-state tracker
- production action log

No external account action is marked complete in this ZIP.

See `V16_PRODUCTION_EXECUTION.md`.
