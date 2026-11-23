# ABaKa Continuing Doctrinal Lessons — DEV release contract (2026-11-24)

## Implementation
- The existing locally bundled Panimula, P1–P2 and A–Z curriculum and completed rewards remain intact. The live ABC rule has been observed at **8 BP**; historical ledger values are always displayed from the server.
- A new published-only, server-owned doctrinal catalog extends the curriculum with unlimited additional rows. The initial four Scripture-linked lessons cover creation, holiness, salvation, and hermeneutics. New material should be reviewed by an authorized doctrinal editor before publication.
- Each published row defines a series, position, difficulty, optional prerequisite and original content. The React Native screen pages 80 items at a time; the detail route fetches only the selected lesson. Published reading content caches per account for offline use.
- The initial continuation is gated on the existing final A–Z lesson (`lesson-26`). Subsequent modules unlock upon server-confirmed completion of their prerequisite. Direct deeplinks cannot bypass the RPC guard.
- A server-side answer key in `private` verifies a 4-option quiz. The reflection rubric checks 80–2,000 characters and at least eight distinct 3+-character tokens, without storing the reflection. This is *basic* verification, **not** AI theological grading or guaranteed meaningfulness.
- Difficulty rewards for **new** continuing lessons: Foundation +8 BP, Intermediate +12, Advanced +18, Deep Study +25. A new continuing-doctrine daily earnings cap of 50 BP (Asia/Manila) applies only to these lessons; once reached, members may still complete and advance but earn **0 BP for excess completions**, clearly messaged by the client. Historical rewards are never recalculated.
- All awards use the existing `buklod_points_ledger` and unique user/source key; a transaction-level per-account advisory lock serializes completion and daily quota decisions. Never trust client-supplied points, difficulty, completion state or quiz answers.
- The original offline A–Z completion sync remains unchanged. A new doctrinal lesson may be read and drafted offline but is **not** marked complete or awarded offline; assessment requires the server.
- No client can write the lesson catalog, publish a lesson, or access server answer keys. Authorized editors publish via an audited migration/service-role workflow. An in-app admin editor has **not** been added in this change.

## DEV rollout / acceptance (not yet performed)
1. Apply the additive migration to isolated staging DB **only**, with a saved snapshot and schema-diff check. Do not apply directly to live MAIN.
2. Verify RLS using authenticated member vs anon vs admin/service accounts; unpublished/answer key never readable to ordinary clients.
3. Verify prerequisites, right/wrong quiz, reflection failures, repeated and concurrent submissions, daily limit boundary (including date rollover), ledger idempotency, claim handling, account switching, weak network/offline reading and pagination >80.
4. Reconcile all production and DEV fixes before an RC; confirm native runtime compatibility, app-wide spacing, ad first-view performance and navigation regression gates. Do not include this backend-dependent feature in production OTA before the migration is deployed and exercised in staging.
5. Keep production untouched until exact RC and runtime are verified; physical Android verification remains a separate release gate.

## Extend content safely
Insert new original `public.buklod_abc_doctrinal_lessons` rows with a unique `doctrine-0005` etc. ID, series key/position, title, difficulty, prerequisite, body blocks, question and exactly four options. Insert the correct choice into `private.buklod_abc_doctrinal_answers`. Keep `published=false` until doctrinal and editorial review, then set `published=true` and `published_at=now()` **through authorized backend admin operations**. No application rebuild is required to show additional published rows.

## Quiz anti-farming hardening (2026-11-24)
- Wrong answers return a non-completion result; the UI does not mark a failed quiz complete or show a successful ad. Server counts incorrect attempts per account and lesson, with a 10-minute cooldown after three wrong submissions. These failed-attempt records live in a private table, not client metadata.
- A per-account, normalized fingerprint prevents an identical reflection from earning progress across more than one continuing-doctrine lesson. No reflection raw text is kept in this anti-copy registry. Meaningfulness still requires a future human/AI rubric for higher assurance; these are bounded heuristics, not doctrinal certification.
- Admin cannot unpublish a prerequisite while a dependent lesson remains published; downstream lessons must be unpublished first.

- The BUKLOD Official System Admin can study and confirm lessons but receives 0 BP, consistent with the existing system-admin economy exclusion. Normal member tiers are unchanged.

## Doctrinal approval gate
The four starter lessons are **unpublished drafts**, not reader-visible content. Their Bible references, theological claims and answer keys must be reviewed and explicitly approved in Admin Doctrinal Studio. The staged SQL migration never auto-publishes newly generated doctrinal material.
