# BUKLOD Security Operations & Recovery — R1

Scope: BUKLOD Main; use existing BSOC, capacity monitoring, and Finance V3. This source-only implementation does not imply production activation.

## Detect
- Database scan every 15 minutes, without new external HTTP traffic, checks missing public RLS, anon callable privileged admin RPCs, unresolved finance fraud flags, BSOC P0 incidents, and backend critical alerts.
- Dashboard exposes only bounded counts and timestamps. Logs, personal data, credentials and fraud evidence stay private.
- Auth audit completeness remains UNVERIFIED without independent log/provider integration. No all-clear claim when configured signals are quiet.
- More integrations required: Auth password-spray monitoring, firewall/bot/DDoS telemetry, Supabase platform health, Android ANR/crash, media integrity and alert delivery.

## Limit damage
- System Admin may activate Finance V3 emergency hold after entering a detailed reason and exact typed confirmation.
- The transaction disables economics, settlement, withdrawal and payout processing, while a DB trigger rejects re-enabling any of these during an active hold.
- Historic earnings, points, QMP and audit history are preserved. No blanket bans, account deactivation or media removal.
- Containment is specific to Finance V3. Independent payout and external provider rails require separate audit. Existing Finance flags are OFF and must remain OFF unless separately approved.

## Protect data and money
- Never place service-role credentials in Expo/web bundles. RLS applies to all public tables; authorization checks remain server-side.
- Private operational tables have RLS and no anon/auth direct table grants. Privileged RPCs check the authenticated System Admin role.
- Containment actions use optimistic locking, idempotency key, immutable action log and server-side typed confirmation.
- Hold release requires an AAL2 MFA session, a verified immutable source SHA and signed-off references for backup test, admin session review, API permissions and financial reconciliation. The operator supplies attestations; R1 cannot independently verify these.
- Releasing a hold NEVER activates settlement or payouts.

## Respond and restore
1. Create an incident in the existing BSOC/Command Center and preserve timestamps, severity and sanitized evidence identifiers.
2. If funds are at risk, activate the emergency Finance V3 hold; verify all four switches are OFF.
3. Revoke compromised sessions/keys in authorized provider consoles; do not assume this database migration automatically revokes them.
4. Contain DDoS at the actual provider/API edge, not solely a Vercel frontend.
5. Verify the exact GitHub source SHA, Expo runtime and deployment state, and independently reconcile AdMob-funded payouts and financial journals.
6. Verify the backup exists and perform an isolated restore drill. Supabase database backups do not include stored media objects; verify separate Storage object backups and RPO/RTO.
7. Restore application access only after verified read-only security probes, affected-account authorization, privacy testing and independent functional regression checks.
8. Only then record recovery evidence with AAL2 and release the finance hold. Finance operations stay disabled until independently authorized.

## Release gates
Rollback-only SQL simulation on live schema; Node + SQL regression tests; typecheck; engineering accountability CI; exact RC and production promotion; post-deploy cron/signal and role-verification checks. A failed Vercel Classroom preview must not be misrepresented as a failure in Expo but may remain a repository-required gate until properly isolated.
