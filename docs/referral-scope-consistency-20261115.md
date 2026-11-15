# BUKLOD Referral + Scope Consistency — 2026-11-15

Based on main SHA 66b3eefaeae7f9f136a98fdef08e1cba2ecfb742; DEV only pending RC and OTA gates.

- Referral suggestions expose the canonical 10-character code for Finance-linked accounts. Older accounts without Finance identity retain discoverable 8-character legacy aliases, clearly marked financially pending. Old aliases remain accepted input and cannot be treated as paid referrals. Authenticated sign-up attribution refuses another already locked referrer and requires a confirmed optional referral before signup.
- Historical referrals with trustworthy source attribution and BOTH valid identities are copied as PENDING only, never qualified or paid. The existing BUKLOD Official ban is enforced; it must not be bypassed.
- Organization My Cluster is scoped; other Organizations' Cluster memberships remain visible as a separate count. Functional roles are distinct from administrator permission.
- Eligible members can voluntarily choose active Organization/Cluster Community destinations. Server checks their membership, serializes updates, and honors configured switch locks. This never creates cash.
- New registration passwords: 10+ characters including letters and numbers. Existing login/password reset behavior unchanged.

## Dry-run verification
A single SQL transaction on 2026-11-15 compiled the migration, verified the canonical referral suggestion for `biboy`, and returned 6 Finance referrals including 3 provenance-marked historical PENDING attributions; ROLLBACK. The original Official guard blocked an initial draft; the final migration retains the guard and filters ineligible Official records. No migration was persisted by this test.

## Ordered release gates
1. Verify merged DEV / RC against current main and all already shipped changes; run focused test + TS/CI.
2. Apply SQL migration before same-source staging-user Android OTA and web build.
3. Verify by physical device if available (owner has waived device check), or use static/automated acceptance: canonical suggestion, legacy-code lookup, duplicate and wrong-referrer retries, scope member isolation, destination lock, existing ad/media behavior.
4. Check Finance flags unchanged (economics, settlement, withdrawal, payout processing all OFF), no payouts/credits, and security/RLS/grants.
5. Only after full consolidated release gates, publish exactly frozen approved RC to production and verify manifest/readback. Never assume a DEV commit is live.

Historical records with no Finance identity are preserved in historical count and must not create a synthetic financial person or payout.
