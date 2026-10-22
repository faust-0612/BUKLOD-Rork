# BSOC R3 — Efficient Monitoring and Safe Repair Contract
Status: DEV proposal; NOT deployed. Complements BUKLOD_ENGINEERING_OPERATING_POLICY.md.

## Correlation (Asia/Manila, rolling 1h; compare preceding hour)
Collect minute-bucketed Auth and Data API 500/502/503/504 with **denominators**, affected sanitized endpoints, PGRST002/003, gateway freshness, synthetic checks, DB connections/max_connections, idle-in-transaction, lock waits, cron job failures and timeouts. Never call 0/0 healthy. Prefer incremental aggregation, bounded queries and stable 1/5/60-minute windows; avoid expensive unbounded log scans or storing personal identities.

## Activity and capacity
Correlate per-minute active sessions **only where privacy-safe presence telemetry exists** (distinct sessions, not raw identity), request rates, concurrent inflight work, retries, SQL/editor/admin activity where observable, production app/web traffic and scheduled/background tasks. Classify source only from reliable instrumentation; otherwise UNKNOWN. Do not attribute a spike to a user, old APK, or editing without direct request-level evidence. Treat 70% DB connections as warning and 85% as critical **heuristics**, not vendor hard limits; connection waits, PGRST002/003, 5xx and latency override utilization thresholds.

## Client requests and media
Use private.buklod_bsoc_client_request_summary_r1() restricted to kind, safe_code, result, count, last_seen. Deduplicate by safe_code/kind/time window. Urgent REQUEST_HELP/RECOVERY_FAILED increases and independently verified recovery can alert; routine UPGRADE_NOTICE cannot. APPLIED_VERIFIED is only client-reported. Reporter remains staged until explicitly verified in production. Read-only seven-day Community Wall non-AWS media_path and community_post_media reference checks against community-media storage.objects; report new missing counts and post IDs only. Storage reference integrity does not prove image rendering.

## Alerting
Notify ONLY materially new/worsening incidents or independently confirmed important recovery. Include ACTIVE/RECOVERING/RECOVERED, exact Manila window, error numerator/denominator, relevant endpoints, DB/cron/probe evidence, uncertainty and one next move. Cross-check independent uptime workflow if available. No alerts for silence, ordinary upgrades, or 0/0.

## Automatic repair — separate authorization and gates
BSOC monitor is READ-ONLY and NEVER performs DML, DDL, code changes, deployment or OTA. An independently authorized repair coordinator may open an incident with sanitized evidence and:
1. INSPECT authoritative source and actual production; identify minimal reproducer.
2. PROVE causal defect and scope. If evidence insufficient, remain observation-only.
3. FIX in isolated DEV (or narrowly authorized proven database repair); no broad privilege/RLS changes, mass data edits or unverified automatic restarts.
4. TEST targeted behavior, negative/security cases, regressions and resource usage.
5. VERIFY release compatibility and latest cumulative production baseline.
6. RELEASE DEV → frozen RC → exact Production OTA only when all gates pass; backend-only fixes require independent verification.
7. REPORT FIXED only with observed successful verification and actual release ID. Otherwise report PARTIALLY FIXED/BLOCKED.

## Required implementation acceptance checks
- Simulated low-traffic/high-failure and high-traffic/zero-failure windows must not be conflated.
- Correlate editor/admin load separately from ordinary users only if source tags are verified.
- Timeouts in telemetry must be UNKNOWN, not zero.
- No duplicate client incidents and no personal identifiers in alerts.
- No unauthorized mutation by monitoring.
- Do not enable autonomous production changes by merely merging this document.


## Autonomous next-move execution (owner authorization, 2026-10-23)
- An alert's Suggested Next Move is an **executable investigation task**, not a request for the owner to manually copy a prompt. Route it to a separately permissioned repair coordinator with an incident ID, safe log pointers, severity, last verified state and idempotency key.
- The monitoring scheduler stays READ-ONLY; it must not have write credentials. The coordinator executes independent read-only diagnosis automatically, then only **preapproved, scoped, reversible** changes after proving the cause and passing tests. Owner approval is still required for destructive changes, access-policy widening, expensive scaling, billing changes, or release-gate exceptions.
- Classify outcomes as OBSERVING, DIAGNOSING, PROVEN, FIXING, VERIFYING, FIXED, PARTIALLY_FIXED or BLOCKED. FIXED requires actual production evidence, not a completed GitHub commit.
- Deduplicate incidents by affected endpoint + error family + bounded time; cap retries, apply exponential backoff, circuit-break on repeated failure, and never spawn recursive investigations.
- Track known fixes with fingerprints, preconditions, expected result, rollback, test and release evidence; do not blindly reapply fixes to different failures.
- When database connectivity is unavailable, log UNKNOWN and defer writes; do not equate SQL timeouts with 0 failures. Preserve last verified metrics separately.
- Keep a clear audit trail of action, tool execution, changed artifact, test, deployed release ID, and verification. Never expose user identities, secrets or full SQL editor text in reports.
- A draft PR or document alone does NOT deploy an autonomous system. Implement a real event dispatcher, coordinator permissions, durable queue, test harness and alerts before marking operational.
