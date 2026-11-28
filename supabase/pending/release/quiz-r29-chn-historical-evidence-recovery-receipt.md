# Quiz R29 recovery receipt — 2026-11-28

- Target: MAIN Supabase `yhanxndaqbmuzbdqlblu`.
- Applied source: `71df31a8ec494ba86aec3e69ecfa1c6cd68af7ee`.
- Migration: `quiz_r29_chn_historical_evidence_recovery`.
- Rollback-only QA: `R29_ROLLBACK_QA_PASS`; attestation table absent after rollback.
- Dedicated source reconciliation: 5 matching attempt digests, 250 response records, bank hash match.
- Apply migration: success.
- Independent live read-only QA: `R29_LIVE_QA_PASS`; 5 recovered attempts, 250 reconstructed assignments, 34 AI-eligible pending responses, 5 pending/unreleased attempts, original response hashes unchanged.
- Owner-context review RPC and payload RPC with reference confirmation false: passed for all five attempts; no AI provider calls or grade changes.
- Security advisor: private attestation table RLS enabled without client policies, intentional deny-by-default; migration verifies no anon/authenticated access.
- Reconstructed canonical question order is not the original randomized display sequence. No original frozen snapshot is claimed.
- Web frontend unchanged; R28 preview is the compatible interface. Actual provider output, authenticated browser interaction and production web promotion are not verified by this receipt.
