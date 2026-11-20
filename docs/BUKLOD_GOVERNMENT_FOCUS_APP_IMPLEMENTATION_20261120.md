# BUKLOD Government — DEV integration contract (2026-11-20)

**Entry point:** existing Profile → BUKLOD Focus Apps → Government, route `/profile/buklod-local`.
**Base:** `integration/genesis-next-conso-staging-ota-20261120`.
**Status:** DEV source only. Not migrated, staged, rendered on an Android device, or live.

## Included in this branch

- Public citizen directory for verified agencies; office follow preference; local government announcements within the Government Focus App.
- Government registration requests with System Admin-only verification and verified initial owner provisioning.
- Separate verified government staff roles with backend checks (owner, admin, publisher, concern handler, auditor, emergency publisher).
- Official agency posts, with mandatory server-side jurisdiction checks. Only verified NATIONAL agencies can opt into nationwide Public Wall cross-posting, through the canonical community-post RPC with existing moderation and notification behavior.
- Official service links (HTTPS, links to existing agency portals); public events and programs.
- Private citizen concerns, server-atomic status updates, case timeline, RLS isolation and idempotent intake/updates.
- Append-only government verification, staff and publication audit logs.
- Retry-safe posting and concern operations to avoid duplicate submissions under weak networks.
- Citizen information is free; administrative authority is **never** derived from Focus App entitlements, scope roles or caller-supplied metadata.

## Dependencies / incomplete delivery

1. **Location-targeted posts in the shared main Public Wall**: the separately reviewed Public Wall "post as scope" feature is in PR #1038. This Government branch intentionally does not merge or duplicate that feed/identity engine. Municipal and barangay official posts are delivered in the Government Focus App by agency and verified locality, **not** yet cross-posted into the existing main Wall. Government posts with `public_wall_post_id` are only possible for verified national agencies.
2. **Government push alerts and concern status notifications**: only office follows and backend event history are present. Safe opt-in notification fanout/delivery has not been activated.
3. **Citizen photo attachments, geospatial PSGC directory import, multi-jurisdiction user preference filtering**, and integrations to eGovPH/eLGU/ARTA are not yet implemented.
4. Formal government onboarding requires independent authority/official-email review, privacy impact assessment, lawful basis, retention and escalation policy, and contractual authority to integrate systems.
5. No Supabase migration has been applied to live project `yhanxndaqbmuzbdqlblu`. The client will fail closed with service-unavailable feedback until the migration is applied to a safe, verified environment.
6. No OTA, APK, AAB, production release, or device visual verification was performed.

## Mandatory release gates

- Apply migration only on an isolated testing database and verify SQL parses, RLS policies, staff privilege escalation denial, staff role revocation, official approval, national-post restrictions and per-entity jurisdiction enforcement.
- Confirm duplicate client requests produce exactly one post/case/status event; confirm case owner cannot read another citizen's case or staff audit details.
- Run `node --test tests/buklod-government-focus-app-source-20261120.test.mjs`, TypeScript checks, relevant Wall, navigation, offline retry and AdMob first-view regression suites.
- Reconcile/merge PR #1038 only after its own verification, then add government author identity in shared Wall and locality-specific delivery filters as a separate reviewed change.
- Verify actual Genesis staging Android rendering and communication, unless the owner explicitly waives **device visual verification only**; skip visual verification does not waive authorization/security/release gates.
- No production activation, OTA, or automatic agency approval before the above gates.

## Data and accessibility decisions

- User selects/follows locations; precise GPS is not required or published.
- Location keys may only be agency's verified PSGC code or codes separately granted by System Admin.
- A BUKLOD citizen concern reference is not an agency's legally acknowledged or formally filed case by default.
- Official advisory visibility is never monetized, and complaints do not give points or rewards.
