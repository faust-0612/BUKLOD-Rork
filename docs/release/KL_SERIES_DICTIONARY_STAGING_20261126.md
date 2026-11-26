# KL database glossary and series bookshelf — staging intake

Source-only, NOT deployed. Existing production chapters and rewards must remain intact.

## Release ordering
1. Validate the two additive migrations against the exact staging schema, with RLS/role tests (anon, member, active and inactive admin, service worker). Verify Series 1 count/title, original chapter IDs/manuscript hashes, quiz hashes, approvals and reading progress unchanged.
2. Deploy `kl-dictionary-worker` only to the authorized target. It needs existing Gemini key and a dedicated cryptographically random 64-hex `KL_DICTIONARY_WORKER_KEY`, identically provisioned in Edge secrets and Vault. Configure Vault `KL_DICTIONARY_WORKER_URL` to the same environment's function endpoint. Do not copy secrets into repository/logs. Gateway JWT verification must be disabled for this worker only; its dedicated constant-time auth is mandatory. If secrets are missing the dispatcher skips and no AI call occurs.
3. Test upload of a small authorized JPEG/PNG/WebP, invalid types/size, create draft, member inability to see draft, explicit cover publish, chapter approval/quiz/release, reading from exact episode IDs, return navigation, reading/ads, offline Series 1 fallback and prior chapter glossary. Verify no new series appears from a legacy chapter-create call.
4. Verify one released chapter job transitions to ready, invalid or stale source cannot be saved, duplicate/alias terms are not inserted, previously released definitions can be reused, and future/draft terms cannot be fetched. Simulate retry/backoff/quota and worker lease expiry. Check generated meanings against the evidence; exact evidence does not mathematically prove semantic accuracy. Run database advisors and full TypeScript/CI/Android runtime gates (including mandatory ad/navigation tests).
5. Only after verified backend and compatible runtime, issue staging OTA; do not deploy production or announce until release gates and owner approval.

## Operation
- Series 1 is seeded only to preserve existing catalog; uses the approved bundled cover until an admin uploads a replacement. Series 2–12 must be explicitly created, covered and published. No automatic series/chapters.
- Public series list returns published records only; cover bucket private, signed URLs; maximum 5 MB. No unpublish operation to avoid invalidating legacy released chapters. Admin creates chapters using existing Studio and existing approval rules.
- Worker polls every 15 minutes. No reader-triggered AI calls; one job/source hash at a time, up to 24 new distinct terms, exact source evidence, released only. Automatic backoff and daily cooldown recover interrupted jobs. A new editorial revision has its own hash. Curated bundled terms/aliases retain priority; generated definitions are available across later released chapters only when they appear in the current prose. Offline reader keeps bundled glossary.
- Monitoring: private.kl_dictionary_jobs_v1 state/attempts/next_attempt/last_error; never expose manuscript or credentials in logs.
