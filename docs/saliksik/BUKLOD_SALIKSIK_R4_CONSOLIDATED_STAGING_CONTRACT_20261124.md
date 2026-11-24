# BUKLOD SALIKSIK R4 — Zero-required-Admin research and complete-manuscript release candidate
**Date:** 2026-11-24 · **Status:** source-only DEV candidate, consolidation/RC HOLD. **No staging-user OTA or production authorization.**

## Owner-approved final member journey
1. Open faith-enabled Cluster Home → SALIKSIK. The page renders without a new dashboard network dependency.
2. **Member chooses a research question**, existing Bible reference (e.g. Juan 1:1–14) and one of eight recognized research methods: exegetical, biblical theology, systematic, historical, comparative, practical, Christian education, or mission/leadership. No Admin upload, publication, classroom approval, or prescribed new university lessons required.
3. BUKLOD reads **canonical KJV Bible corpus data from existing BUKLOD MAIN Bible tables** (not free-form AI-generated scripture). It creates a private, idempotent, rate-limited, resumable research job. Eight objective investigation activities are generated in bounded pairs, reviewed by a second independent source critic, and validated against exact canonical quote spans before versioned publication.
4. The member completes four Discover (5 source-backed questions each; +10 BP), four Investigate (10 questions each; +20 BP), and one Written Master (three different 220–4000 character essays). Server-owned objective validation checks five competencies and 80% weighted pass; Investigate additionally requires 70% in Evidence, Context and Reasoning.
5. Written Master uses deterministic canonical citations and **two blind independent rubric evaluations** (20% understanding / 25% evidence / 20% context / 25% reasoning / 10% transfer). Scores must independently satisfy 80% and 70% core gates, with bounded score agreement; disagreement or unsupported citations produces actionable REWORK, **never** an automatic pass. Settlement is a privileged server transaction, not an AI/client-led credit insert. No mandatory Admin approval for canonical-corpus work.
6. Exactly nine unique verified learning completions yield the existing max **205 pending BUKLOD Points** (+40 Discover, +80 Investigate, +35 Master, +50 collection) per immutable collection, subject to active canonical Point Rules. **Manual individual BP claims remain unchanged**, no Claim All, no automatic QMP/payout/AdMob cash.
7. After verified nine-part collection completion, **DOWNLOAD COMPLETE MANUSCRIPT** unlocks immediately. When verified original redistribution rights were confirmed once for a private source, the actual complete original may be signed for download. Otherwise every qualified member can download all nine published chapters compiled as a private, versioned DOCX. No Admin review per member and no Points claim requirement. Server checks membership, publication, version, nine mastery records and final series before a short-lived signed link. Users may re-download later.
8. Verified qualifying written research is retained as **private Academic Research Evidence** for the proposed BUKLOD University internal Registrar. It is not itself UC or a degree: no fake qualifications, signatures, credits, or completion papers are minted until the independently verified academic program and issuer policies exist.

## Operational details / reliability
- Default rollout remains **OFF**: EXPO_PUBLIC_SALIKSIK_ENABLED must not be enabled until the isolated backend and app release gates pass; DB saliksik_rollout.member_enabled also stays OFF in deployment.
- The client may perform up to four resumable *on-demand* generation batches automatically. If Android app is closed or the AI provider fails, current source/draft/queue state survives; on next opening the app automatically resumes from the last verified batch. **No unattended scheduler or guaranteed background completion is claimed in this release.**
- Maximum three fresh research requests/member/rolling 24h; deduplicate identical topics, bounded worker leases, 12 generator attempts ceiling (held after repeated verifiable failure), 6 reviewer attempts, 35-second model request deadline, stale worker token fencing, unchanged private original bucket and answer keys.
- Unverifiable generated source, bad citation, ambiguous answer, or independent critic disagreement blocks publication or reward and returns to queued/held/rework safely. Progress and written answers are member-private, all privileged calls require server-role validation.
- No optional Admin source upload is required for **canonical-source work**. The legacy R2 private-vault route remains isolated and manual because source redistribution/fidelity requires explicit rights. It must never be treated as a prerequisite to the member research lab.
- Existing BUKLOD University v4 blueprint specifies SALIKSIK as a **research-workflow/evidence layer**, NOT an independent lesson catalog. The UC recognition plan remains versioned and source-verified; no ad-watched UC, no automatic credentials.

## Implementation inventory
- Existing R1/R2: 8 objectives + 1 Master, private vault, catalog, mastery, server-only BP ledger, member assessment, legacy Admin content.
- Existing R3 PR #1158: signed completion manuscript download and source rights.
- R4 additive migration 51000: canonical Bible source reference, member request queue, statuses, no-Admin generated investigation publication and catalog source-mode marking.
- R4 additive migration 52000: independent written review and academic evidence receipts; extends R3 manuscript entitlement for **source-less** canonical collections.
- Edge saliksik-auto-v1: authenticated member-initiated research generator and two blind Master assessors; only service role settles.
- Native/web React Native client: source/method chooser, automatic resumable progression, automatic written Master verification, final manuscript download.
- CI: isolated PostgreSQL 17 R1→R2→R3→R4, exact source contract Node checks, E2E negative/positive objectives and complete full manuscript path.

## Consolidated staging release rules
1. Reconcile **exact current main/production and latest Genesis/consolidated DEV** to ensure no concurrent home/nav/wall/video/AdMob/KL/Connect/Academic changes overwritten. Current R4 branch is stacked from unreleased R2/R3 DEV and is NOT a whole-source merge onto current main.
2. Run exact-head required Engineering Accountability, protected feature, TypeScript/web, database security/role, and isolated E2E tests. Cross-user, anon, missing citations, paused Points rules, stale leases, double device, repeated downloads, offline retry and dedupe are mandatory. Runtime Edge/provider behavior is not equivalent to local SQL tests.
3. Keep AdMob fill/render and instant dashboard/tab navigation as hard blockers. Preserve compact app-wide spacing, media offscreen lifecycle, existing KL/ABaKa/Formation, all member privacy, and approved manual BP claim policy.
4. Stage only in a genuinely isolated backend (never on live MAIN), off-by-default feature flags, verify signed Android runtime compatibility, RC packaging, secret management, Edge cold start and real download in a disposable isolated testing environment. **User elected to skip physical device acceptance, which must be recorded as unverified—not passed.**
5. Only then include the exact additive R4 files in the consolidated staging OTA/RC. **No live production SQL, Edge deployment, Play, web deploy, user notification or production OTA is authorized by this document.**

## Current status
DEV implementation files exist; actual SQL/TypeScript/CI/RC statuses must be recorded from exact commit runs, not assumed from this document. The old R2 Admin route is deliberately preserved for legacy optional private manuscripts and not confused with the fully automatic canonical member workflow.
