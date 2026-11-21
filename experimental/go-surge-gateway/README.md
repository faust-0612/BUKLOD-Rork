# BUKLOD surge admission prototype — NOT production wired

This is an isolated Go HTTP admission-control proof of concept, not a database, Supabase replacement, reverse proxy, or live API. It does not access user data, authenticate users, or serve BUKLOD requests.

Run from this directory: `go test -race ./...`, `go run .`.
Local health: `GET http://localhost:8089/healthz`.
Local simulation: `GET http://localhost:8089/simulate`.
Set `MAX_INFLIGHT=64` (default 64). When saturated, `/simulate` returns HTTP 503 with Retry-After: 1 rather than accumulating requests.

## Release gate
1. Reconcile ongoing backend fixes in PR #346 and the current main/production OTA manifest; do not duplicate or merge unrelated work.
2. Define explicit Go-owned API endpoints and per-user authorization rules. Do not forward arbitrary client-supplied URLs or use service-role credentials for general user requests.
3. Use exactly one existing production PostgreSQL database; no paid Redis, second database, or new platform is authorized.
4. Keep Supabase Auth/RLS and direct mobile API behavior unchanged until compatibility and security are verified.
5. Benchmark burst traffic against a controlled non-production workload: concurrency, latency p95/p99, 429/503 rates, recovery and database saturation. This simulated endpoint alone cannot establish real-world capacity.
6. Verify health checks, graceful shutdown, secrets management, observability, budget, rollback and DEV→RC→production release contract.
7. Never route production users to this prototype or trigger OTA from this branch.
