# BUKLOD Global Stability — Scope Lock R1

## Objective (single source of work scope)
Investigate and prevent **correlated multi-feature failures** affecting authentication/session, loading, photos and backend access. Verify the actual live production cumulative baseline before making a release candidate.

## Allowed changes
- Shared authentication/session recovery and safe request handling
- Shared weak-network loading and cached-content resilience
- Backend/Auth/PostgREST/Storage log correlation and observability
- Focused tests for a verified common root cause

## Frozen / forbidden in this workstream
- Character UI, previews, progression, rewards, Circle Rank, R31/R40/R42 contracts
- Cluster/Organization UI and flows; Kingdom; Quiz; unrelated product features
- Permission broadening, anonymous grants, RLS bypasses, native builds, unrelated dependency upgrades

## Enforcement
1. Before editing, write the current objective and expected file allowlist; reject all files not directly required by the verified common cause.
2. Confirm current production fingerprint and cumulative OTA source. GitHub main, historical hashes, and draft PRs are not automatically the approved live baseline.
3. Inspect shared dependency and timestamp-correlated errors; label hypotheses as unverified.
4. Make one isolated DEV patch. Check the full diff against the allowlist before RC. Any unrelated change = stop and split it into a different PR.
5. Add root-cause-specific regression coverage. Keep auth boundaries intact and retries bounded.
6. DEV → tested RC → Production OTA only after all evidence and device checks pass; otherwise HOLD.
7. Do not repeat old diagnostics or run GitHub Actions unnecessarily; use existing evidence, batch related edits, and investigate a failed run before retry.

## Incident evidence
2026-10-22 18:37–18:38 UTC: production PostgreSQL logs showed clustered permission-denied errors in Character RPC, claims, themes, addresses, health events, recovery commands and ad events. Shared auth/role context is a hypothesis, not yet a proven root cause. The return of photos at approximately the same time does not establish causation.

## Branch separation
Character preview PR #277 and Character-inclusive PR #278 are **out of scope** for Global Stability and must not be merged as its fix. Keep them untouched; this branch contains no Character modifications.

## Definition of done
Confirmed root cause + minimal allowlisted code diff + failing-before/passing-after regression test + verified live baseline + successful focused QA + exact RC fingerprint + verified production publication and on-device outcome. Until then status = NOT LOCKED / RELEASE HOLD.
