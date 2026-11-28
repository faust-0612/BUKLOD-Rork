# Connect-only Quiz retirement — checkpoint, 2026-11-28
Target: BUKLOD Connect yhanxndaqbmuzbdqlblu; retire only Quiz Dedicated cjtehbfspgimyhifnjon. Never delete Connect or unrelated projects.

## Verified
- R29 backend recovery live; user reported actual checking working in R28 preview.
- All 61,959 Dedicated response rows and 1,420 questions have exact aggregate SHA-256 matches in Connect raw archival records. 50 responses and one attempt are intentionally quarantined for unresolved identity.
- 29,850 original Dedicated private assignment rows match Connect public assignments field-for-field; R29 adds 250 separately attested reconstructed assignments.
- All 98 Dedicated storage object paths, sizes and ETags match Connect inventory; this is metadata/ETag matching, not independent object-download SHA-256 verification.
- 110 source delta payloads copied to private Connect archive and validated by source checksums. Rechecked 2,510 source administrative/profile/auth-reference records; zero unpreserved current versions.
- No source grades/answers overwritten; no credential material copied (auth reference contains only id/email/created_at).
- Identity: 476 same UUID/email, 2 source-only with no attempts/active roster, 2 same-email different UUID (one has two source attempts); do not automatically merge identities. Historical orphan preserved in quarantine.
- Dedicated had zero STARTED attempts and zero auth sign-ins in prior 24h at audit; not proof of no legacy callers.

## Remaining mandatory gates
1. Promote exactly R28 deployment jf5rqsyiw4 (source 9b6081baf357eaeee945633e71bb41af5104887e) using the pinned script; compare production release marker and JS hashes. No rebuild. GitHub Actions latest five runs startup_failure; use already authenticated local EAS CLI.
2. Deploy pending Connect-only v1 adapter with verify_jwt=true, preserving old client contract and routing into Connect v2; verify faculty and student SSO on production and old clients. No deployment yet.
3. Verify active gradebook, login/recovery, PDF object access, AI review, live room start/submit/release, and zero Dedicated business traffic across appropriate observation interval; resolve or explicitly retain restricted archival identity exceptions.
4. Export independent encrypted backup including database and storage; verify restore ability. Do not copy secrets or authentication passwords into GitHub.
5. Only then pause Dedicated as reversible test, verify production without it, and permanently delete only Dedicated. No permanent delete tool available in the current Supabase connector. Use the Dedicated dashboard when ready.
