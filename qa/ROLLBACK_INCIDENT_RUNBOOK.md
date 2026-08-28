# BUKLOD Rollback & Incident Runbook

## Immediate rollback / hold triggers
Use HOLD or ROLLBACK when any of these occurs:
- private reflection/prayer leakage
- cross-church or cross-group unauthorized access
- privilege escalation
- pastoral-care note exposure
- wrong-account deletion or deletion integrity failure
- data corruption
- severe authentication outage
- notification disclosure of sensitive content
- repeated crash preventing core use
- migration failure with uncertain data state

## First actions
1. Stop expansion.
2. If continued use increases risk, enable Maintenance Mode.
3. Log a P0 incident in Command Center.
4. Preserve minimum necessary evidence.
5. Do not copy leaked sensitive content into general chat/bug channels.
6. Identify owner and affected environment.
7. Record HOLD or ROLLBACK decision with rationale.

## App rollback
If a bad app build was distributed:
- stop promoting/installing the bad candidate
- mark it rejected/superseded
- point testers/users to the last approved safe candidate when platform distribution allows
- use minimum-version gating only when a known-good replacement exists

## Database rollback
Do not blindly reverse SQL in production.

Use:
- tested forward-fix migration when safest
- documented backup/PITR restore procedure when data integrity requires it
- staging rehearsal before executing a destructive recovery step

Record:
- exact migration/build
- incident start time
- data affected
- recovery action
- validation tests
- final decision

## Re-open gate
Before re-opening:
- fix deployed
- P0 privacy/RLS matrix retested
- incident marked retest_passed/closed
- required readiness checks updated with evidence
- new release candidate approved if binary changed
- authorized human records CONTINUE PILOT or GO LIVE
