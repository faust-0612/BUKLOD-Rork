---
title: BUKLOD Unified Modernization Blueprint
date: 2026-11-13
status: planning-dev-not-released
tags: [BUKLOD, architecture, navigation, obsidian, reliability, rag, release]
related_prs: [777, 783, 784]
related_issues: [781, 782]
---
# BUKLOD — Comprehensive Engineering Implementation and Reconciliation Plan

**Authority:** This document is a source-backed implementation contract, **not authorization to deploy**. Follow the BUKLOD Engineering Memory Protocol: Read Memory → verify latest production/main/PR state → isolate missing changes → test → freeze RC → staging-user installed verification → owner approval → later web/production release → update Memory. GitHub BUKLOD-Rork is authoritative for code; Expo installed artifact for deployed app; Supabase readback for backend; private Obsidian memory for decisions.

## 1. Product objective and current verified boundaries

**Chosen architecture: STABILITY-FIRST MODERN UX + APPROVED KNOWLEDGE + RELIABLE JOBS.** Optimize actual Android use, no regression and no unnecessary infrastructure. Canonical global **Home | Cluster | Wall | Connect | Profile** remains unchanged. Scope Home/Community/Connect, Wall, Profile, notifications, ads, Connect/PTT, Bible/KL, offline content, games and account-security permissions remain functional. Do not reactivate retired IGPAT.

### Evidence ledger (2026-11-13; refresh before edits)

- Inspected canonical main: **9f412afd71b74e41995a3a1a63e05e72f78b6e39**. Its three-file delta from prior published-source main is staging-mirror workflow/contract/test only, *not a product update*.
- Publisher-side Android production publication: source **a43e1813d62a151e8294a52989a80fe21b36057c**, runtime **1.3.2**, channel **production**, Expo update **01a1d2d6-bae3-74df-bbf4-2bdd9df35215**, run https://github.com/faust-0612/BUKLOD-Rork/actions/runs/43355306642 (2026-11-13 02:57 UTC). Web publisher-side workflow 43355306645. **Neither proves physical handset delivery.**
- Main's newly merged staging-mirror fix corrects the staging signed APK artifact URL parser and enforces source parity to the above published source. **No signed downloaded/installed staging APK was verified during this planning task.**
- **[PR #783](https://github.com/faust-0612/BUKLOD-Rork/pull/783)**: existing Navigation V2 DEV, 44 changed files, existing **21** checklist entries, **0 independently verified**; currently green source CI, draft/unmerged; exact compiled Android RC and installed staging parity still absent. **Do not create another navigation shell/checklist.**
- **[PR #784](https://github.com/faust-0612/BUKLOD-Rork/pull/784)**: Wall/Marites 96ms native measurement coalescing and active video priority, source CI green, draft/unmerged and **native crash effectiveness unproven**.
- **[PR #777](https://github.com/faust-0612/BUKLOD-Rork/pull/777)**: SALIKSIK private manuscript vault, adaptive learning and audited human-reviewed Master, SQL/Node CI evidence, draft/unmerged, rollout OFF. **Existing SALIKSIK R2 is the only source of truth for this reward workflow.**
- Navigation [issue #781](https://github.com/faust-0612/BUKLOD-Rork/issues/781), HCI/crash [issue #782](https://github.com/faust-0612/BUKLOD-Rork/issues/782). Companion JSON: [30-reference crosswalk](docs/engineering/BUKLOD_UNIFIED_MODERNIZATION_MATRIX_20261113.json). Obsidian memory in private repository **faust-0612/BUKLOD-Engineering-Memory** (existing Oct 28 baseline there is historical/stale; never override newer evidence).

### Critical non-goals

No AWS, new paid backend project, custom GPU/LLM inference cluster, own KV cache, automatic money/points grading, general semantic-response cache, wholesale animation library swap, indiscriminate database replicas or own CDN/load balancer. Never copy production user data, credentials, manuscripts or financial identifiers into staging/Obsidian/GitHub. **Only eligible AdMob income is distributed using QMP**; unrelated app revenue stays separate. No auto web/production OTA publishing.

## 2. All 30 reference photos — evidence coverage

The JSON crosswalk contains **30/30** individually numbered photo concepts, initial status, justification and priority. In sequence: 1 Tokens/streaming; 2 embeddings; 3 RAG; 4 KV cache; 5 stale-doc quiz; 6 batching; 7 routing; 8 semantic cache; 9 agents/tools; 10 dashboard cover; 11 KPI; 12 charts; 13 filters; 14 quick actions; 15 nav bar; 16 tables/recent; 17 UI libraries cover; 18 UIverse; 19 anime.js; 20 shadcn; 21 Magic UI; 22 React Bits; 23 queues; 24 million users cover; 25 load balancing; 26 multiple servers; 27 caching; 28 database scaling; 29 CDN; 30 autoscaling.

**Already in main:** offline cache, request/avatar/media-sign batching, partial Gemini authoritative-source validation/fallback, admin KPI, priority inbox, capacity page, notifications worker, native Expo/Reanimated components and 5-tab navigation. **Partially:** accessible dynamic input, unified AI and async job contracts, HCI response consistency, actionable version-aware charts, approved-source retrieval. **Not justified now:** GPU/KV internals, separate web-animation libraries on Android, independent server fleet, blindly upgraded compute.

## 3. Reconciliation map (existing code wins; implement only gaps)

| Workstream | Canonical owner | Integration rule |
|---|---|---|
| Navigation V2 | PR #783, docs/navigation-v2-completion.json, scripts/navigation-v2-staging-gate.mjs | Finish **its existing 21 items**, keep Settings gear, compact Home/Profile, bilingual local finder, accessible forms and safe drawers; no duplicate second redesign. |
| Staging APK mirror | main 9f412afd, .github/workflows/buklod-staging-user-latest-main-apk-20261108.yml | Verify package, signing, runtime, channel, preview backend and installed green B; no stale branch merge. |
| Wall/Marites | PR #784, buklod.tsx + BuklodMaritesBoard.tsx | Cherry-pick only evidence-supported safe delta, not new video engine/ad rewrite. Source green ≠ crash fixed. |
| SALIKSIK | PR #777 + its authoritative blueprint, private source/SQL ledger | Reuse vault/source hashes/approval/205 points; optional retrieval adapter must not change rubric, payout, scopes or feature flag. |
| Existing AI | buklod-ai-validate-response, buklod-formation-auto-process, kl-generate-reading-quiz | Reuse server-grounded content and schema verification; new RAG retrieves approved exact revisions, not AI-supplied truth. |
| Caching/jobs | offlineSyncQueue, offlineCache, buklodMediaUrl, avatar batching, notification DB dispatcher | Inventory and reuse before adding pgmq/outbox; safe, idempotent effects per job. |
| Dashboard | admin/index, backend-capacity, priority-requests | Add source freshness, exact-build filters and linked operations to existing cards, not duplicate consoles. |

**Reconciliation protocol:** refetch live source/actual current main; compare current PR heads and file overlap; keep newer equivalent main code; forward-port *only missing tested changes* to isolated DEV scopes; include V2 manifest, lockedFeatureChanges and meaningful regression tests. Do not blindly merge #777/#783/#784, especially if they touch same route/role/UI. Preserve immutable production history.

## 4. Execution waves, dependencies and acceptance

### W0 — Baseline / staging parity / conflict inventory — P0
1. Independently capture installed live and staging Android package IDs, app versions, build numbers, Expo runtime/channel/update IDs/source and device OS. Production is org.mzbministry.buklod; staging is org.mzbministry.buklod.staging, preview EAS and staging-user channel. Publisher-side SHA is **not installed proof**.
2. Verify main delta, latest verified RC, #783/#784/#777 exact file overlaps, backend feature flags, staging permissions and preview Firebase. Freeze staging signed APK only after artifact exists and package/signature/runtime are tested; keep data separation.
3. Capture **rolling 15/30/60-minute** exact-build baselines for OOM/ANR exits, PSS/Java/native heap, media decoders, scroll p95, upload/Connect latency, native AdMob request→fill→impression and backend errors. Do not combine 24h mixed releases.
4. Create conflict-resolution ledger with decision KEEP/PORT/DEFER/REJECT and paths/tests/owner, not speculative broad rewrites.
**Gate:** no false source parity; current installed staging build must be known before staging OTA; independent DEV work may continue while evidence is pending.

### W1 — Finish Navigation V2 — P0, PR #783
- Preserve 5-tab public shell and role-specific scoped Home/Community/Connect; never put retired IGPAT in global finder.
- Implement unfinished canonical 21 checklist: naming, contextual overflow/bottom sheets, gesture alternative menus, low-cost/reduced motion, correct Back/deep-link/draft/scroll state, pending/error/retry feedback, offline recovery, first-use help, role/accessibility QA, anti-regression.
- Readable Android OS-responsive input baseline around **16sp**; test font scale 100/125/150/200%, TalkBack, small screens, contrast, keyboard safe area and **>=48dp effective** touch targets. Don't shrink text to make tiles compact.
- Existing JS keyboard GIF scoped share fallback must remain. Native keyboard rich IME commitContent must be verified with Gboard/Samsung supported MIME/URI/target, preview+explicit Send and no composer jump; **native change requires a new staging APK and later production APK** rather than an OTA-only claim.
- No giant button walls, multiple drawer systems or web animation library imports; use existing MaterialCommunityIcons/Reanimated and proven native components.
**Gate:** all **21 canonical Navigation items** individually verified with evidence in existing checklist; the final staging-release item must only become verified after installed staging delivery. Gate semantics not weakened.

### W1B — Wall/media performance, ads and native crash safety — P0, PR #784
- Trace Infinix X6852 OOM with same build/realistic media and video/photo/ad workload, not browser-only profiling. Reuse existing one-passive-decoder policy, media caching and ad retention.
- Validate #784 coalesced Marites measurement and Wall-vs-Marites active player priority; delayed blur/unmount callback, fullscreen, offscreen, scroll, weak-network, app resume, user media and audio/PTT. Don't replace working video playback.
- Benchmark before/after active decoder count, PSS high water mark, UI/JS frames, blank tiles, ad fill/impression and failures; verify **no material regression**, not blanket never-crash claim.
**Gate:** measured stable installed RC and no repeatable critical failure, with same-source comparison. Only then forward-port into integrated RC.

### W2 — Durable task processing/reliability — P1; server-only independent DEV
- Existing client offlineSyncQueue is NOT a server queue; existing DB notification worker already provides scheduled processing. Audit each pipeline before change.
- For new admin manuscript extraction, AI generation, indexing and optional fanout, use canonical **job_id + kind + owner/scope + source_version + idempotency_key + status + deadline + attempts + next_attempt + lease/fence + trace + last_error**.
- Begin with transactional outbox in existing Supabase. Evaluate **Supabase Queues (pgmq)** only if installed/version eligibility, cost and real need are proven; it can redeliver after visibility timeout. **Exactly-once business effect** requires idempotency and transactional domain uniqueness, not queue advertising.
- Worker budget per scope, bounded concurrency, retry only transient failures with jitter, dead letter and manual replay audit. No points committed offline; no silent duplicate notifications or destructive retry.
**Gate:** nonprod SQL/RLS tests for cross-account isolation, crash mid-job, expired lease, duplicate request, deadline, bad MIME, provider 429/503 and eventual durable recovery.

### W3 — Approved document knowledge and SALIKSIK reuse — P1, PR #777 remains authority
- Preserve SALIKSIK original private DOCX/PDF/TXT, upload SHA, immutable published revisions, reviewed questions and Cluster-only authorized entry. Do not create another admin vault.
- Introduce a separate *optional index adapter*: source id/version/hash; approval+access status; scope, language, section offsets/extraction reliability, citation spans and vector-model version. Require permission BEFORE query/ranking; publishing, revocation and archive invalidate stale chunks.
- Start with PostgreSQL **full-text + scoped metadata**. Only if held-out Tagalog/Taglish/synonym retrieval evaluation proves benefit, add Supabase pgvector/hybrid index; not all documents need embeddings.
- AI output cannot be truth: source-exact quotations, schema/rubric checks, versioned citations, prompt injection isolation and honest "not found" if stale. Cache immutable reviewed derivatives, not user-specific grading.
- **SALIKSIK points must remain 4×10 + 4×20 + 35 + 50 = max 205**, human-admin-verified written Master with 3 essays, central transactional ledger and payout separation. Rollout OFF until its own backend + staging verification and approval.
**Gate:** zero private document/answer leakage under RLS, no stale revision answer, citations tie to exact approved passage, no duplicate credit with concurrent device retries.

### W4 — Bounded AI routing and safe caching — P2
- Standardize tasks: lesson validation, question generation, admin source search and safe summary; per-task cost/token/time cap, model whitelist, typed JSON, fallback only on appropriate errors, prompt/source/rubric version and trace IDs.
- Health/finance/privacy/permission and personalized grades must never hit a broad semantic-answer cache. Do not deploy unrestricted autonomous tools or service-role access from client.
**Gate:** malformed output, injection, wrong model, provider timeout/budget, stale cached source and contradictory document regression tests. No unreviewed model-issued points.

### W5 — Actionable existing System Admin dashboard — P2
- Keep admin/index, backend-capacity and priority-requests as canonical. Add build/runtime/OTA-source filters and **latest 15/30/60 minutes**; source, freshness, denominator and UNKNOWN on missing telemetry.
- KPIs: Android OOM/ANR, Wall startup/scroll/blank photo, Connect/PTT latency, upload failures, AdMob fill→impression, queue stuck/failed, backend cache/connections/p95/5xx, BSOC pending aged, AI generation errors/cost. Avoid irrelevant charts.
- Cards deep-link to exact case, log/incident and safe retry. **Seen/Read ≠ Resolved**; authorizations enforced server-side. User AdMob earnings remain separate from other revenue; hide gross/pool formula from members.
**Gate:** role-specific RLS, truthful data freshness and no extra first-screen blocking requests.

### W6 — Measured capacity only — P3
- Existing caching, targeted indexes, CDN and provider-hosted scaling are foundation; no custom LB, many servers, paid CDN, new project or compute upgrade without evidence.
- Correlate latest DB CPU/memory/pool wait/lock, Realtime/Storage/PostgREST sources, p95 per RPC and cost. Optimize bad indexes/RLS/excess requests first; use safe query plans and rollback.
- Controlled **nonprod** concurrent ramp 20→50→100 realistic sessions, then 500/1000 only if previous gate + budget pass. Include auth, scoped Wall/Connect, media/ad, offline+quiz and durable jobs. No production synthetic mass-writes.
**Gate:** quantified safe capacity curve, bounded recovery, no duplicate writes, security pass, recommended plan based on measurable economic benefit.

## 5. Parallel execution and exact integration order

**Dependencies:** W0 → W1 plus W1B → frozen Navigation RC → staging-user; W0 → W2 → W3 → W4 is a separate backend feature-flag lane; W0 → W5 → W6 is observable operations lane. W2/W3/W5 non-overlapping research and DEV tests can advance while staging parity is blocked. Do not merge backend unfinished features into Navigation release to make it look 100% complete. A safe Navigation RC does not require SALIKSIK launch or millions-user certification.

**File collision policy:** single owner per same path; compare Git 3-way against latest main; preserve existing tested behavior and exact manifest; no changes to unrelated RLS, Points, AdMob or stable player. Each workstream uses own V2 .buklod/scopes manifest + changed behavioral test. Prior passed CI needs re-run on the final integrated SHA, not copied as an RC pass.

## 6. Mandatory engineering/release gates

- Existing `AGENTS.md`, `scripts/engineering-regression-gate.mjs`, `scripts/protected-feature-lock.mjs` remain required; no weakened tests, changed scope or bypass.
- **Navigation 21** items in PR #783 is the **sole** progress ledger. This file's matrix is coverage/architecture tracking and must not independently assert a navigation item complete. 30/30 image concepts classified in JSON.
- Any server migration: isolated reversible/non-destructive SQL+RLS tests, role/user isolation, no unauthorized production mutation. Any device/native change: compiled runtime-compatible APK/RC and actual installed verification.
- Acceptance journeys: first use, password/settings, five tabs, role/scoped navigation, 200% font/TalkBack, IME GIF target, Android Back and notification deep link, long-press+tap alternative, poor signal/draft retry, duplicate tap, post privacy, ads/media/PTT, logout/login state.
- P0 30/60-minute same-build Android stress: no observed crash/ANR, responsive top navigation, bounded memory/decoder activity, no blank Wall, correct auto-play and no AdMob suppression; **measure and log actual results**.
- RC freeze: exact SHA, approved delta, compiler/build and security checks, OTA runtime/app/native compatibility, staging package/source mirror and nonprod backend contract.
- **Stage-first release:** original signed staging APK if compatible or rebuild for native IME; run `node scripts/navigation-v2-staging-gate.mjs --prepublish` with exact SHA/evidence; manual `staging-user` Android-only channel update; installed Infinix readback and `--release` gate after update. Missing actual release evidence is BLOCKING, not N/A.
- **Web and production Android: only after separate owner approval.** Reconfirm latest production SHA, runtime/channel/verified artifact, regression gates and end-user postpublish behavior. No automatic merging/push from this doc.
- Rollback: stay on last verified production client until promotion. For JS OTA regressions, republish prior verified compatible artifact only with authorization. Native IME failure needs compatible APK rollback; reversible schema feature flags, not destructive rollback of historical points.

## 7. Completion contract / ownership

Each W0–W6 task must have owner, exact source path, current baseline, tests (Node/Jest/SQL/Android), CI URL, device/result, pending/manual dependencies and rollback; "implemented" and "verified" are different. New execution must resume from latest verified state, not recreate completed PRs. Record code status **DEV / CI / RC / STAGING / WEB / PROD** independently.

At this plan commit: **documentation only; 30/30 photo concepts classified, 21/21 navigation IDs referenced but 0/21 verified; exact-source #783/#777/#784 still draft and no staging/web/production release by this plan.** Out-of-date Obsidian October baseline must not supersede November publication; memory protocol link below.

### Official design references
- https://supabase.com/docs/guides/queues
- https://supabase.com/docs/guides/ai/automatic-embeddings
- https://supabase.com/docs/guides/ai/hybrid-search
- https://docs.expo.dev/eas-update/deployment/
- https://reactnative.dev/docs/performance
- https://developer.android.com/guide/topics/ui/accessibility/apps

**Next agent:** read private BUKLOD-Engineering-Memory/AGENTS.md, current BUKLOD-Rork AGENTS.md, this plan, #783 canonical 21 list and #777/#784. Verify latest Git and device state before code. Do not invent readiness.
