# BUKLOD v9 — Production Hardening & Launch Readiness

## What is implemented in code

- required policy-version tracking
- privacy notice / community guideline / pastoral-care acknowledgement gate
- cached acknowledgement state for returning users during temporary offline use
- data-subject request workflow
- permanent account deletion screen + authenticated Edge Function
- content reporting
- system-admin moderation queue
- moderated prayer visibility
- global offline banner
- retry of push-token registration after reconnect
- Expo Router root ErrorBoundary
- Suspense loading fallback
- custom not-found route
- release app config
- app icon and splash PNG assets
- EAS development / preview / production build profiles

## Privacy / Philippine launch review

Before public use, BUKLOD's final privacy notice should identify the actual Personal
Information Controller, official privacy/DPO contact, processing purposes, recipients/
categories of recipients, safeguards, retention schedule, and how data-subject rights
can be exercised.

The current notice is intentionally marked DRAFT because those organization-specific
facts must not be invented in code.

The National Privacy Commission's IRR emphasizes transparency, legitimate purpose, and
proportionality, and says personal data should not be retained longer than necessary.
BUKLOD's production policies should therefore collect only what is necessary and define
actual retention periods rather than storing records indefinitely.

## Supabase production checklist

Before launch in the Supabase Dashboard:

- verify RLS on every client-exposed table
- review Security Advisor findings
- enable SSL Enforcement
- consider database Network Restrictions
- protect Supabase organization/admin accounts with MFA
- enable email confirmation
- review Auth rate limits
- enable CAPTCHA/bot protection on public registration where appropriate
- configure production SMTP rather than relying on the default testing service
- verify all secret/service keys stay server-side only

## Backups

Supabase manages database backups according to plan. For a ministry production system,
document:
- backup frequency
- who is authorized to restore
- recovery test schedule
- acceptable recovery point / recovery time
- whether Point-in-Time Recovery is warranted for the selected plan

Backups are not a substitute for testing migrations in staging first.

## Account deletion

The `delete-account` Edge Function uses authenticated-user mode and privileged server
access to delete the requesting Supabase Auth user.

Important:
- Supabase documents that Auth-user deletion can fail if the user owns Storage objects.
- BUKLOD v9 does not yet create user-owned media uploads.
- If profile photos/community media uploads are added later, implement Storage cleanup
  before calling `deleteUser`.
- The client signs out after successful deletion because deleting an Auth user does not
  by itself guarantee immediate removal of an already-issued local JWT/session.

## Moderation

Members can report:
- community posts
- prayer content
- future: comments through the same endpoint

System admin can review the queue and choose whether to hide content.

Do not use moderation tools to erase legitimate criticism merely because it is
uncomfortable. Moderation should be tied to published community/privacy rules.

## Offline behavior

v9 adds network awareness, but it does NOT pretend that online writes succeeded while
offline. Existing Supabase write screens should display their normal server error when
a write cannot be completed.

A future advanced offline-sync engine would require:
- mutation queue
- conflict strategy
- encrypted local storage where appropriate
- replay/idempotency design
- special care for privacy-sensitive prayer and pastoral data

Do not add naïve background syncing for pastoral notes.

## Error monitoring

Expo Router provides route error boundaries and loading fallbacks. v9 includes both.

For production crash monitoring, Sentry is optional. If enabled:
- do not attach prayer text, private reflection text, pastoral notes, tokens, or other
  sensitive content as error context
- verify production source maps
- treat crash logs as another data-processing system covered by the privacy notice

## Release strategy

Recommended:
1. development build
2. preview/internal testing build
3. limited ministry pilot
4. fix privacy/security/usability issues
5. production build
6. store submission
7. staged rollout
8. monitor crashes, auth abuse, database performance, and support requests

Do not launch directly from the starter repository without staging tests.
