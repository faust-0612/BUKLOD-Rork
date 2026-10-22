# CURSOR EXECUTION ORDER — KABIHASNANG LIGAW R5 TO OTA READY

**Owner directive 2026-10-21: Finish all achievable work autonomously in one cloud execution. No repeated handoff cycles.** This is a task order, not proof of execution. Cursor must read this file on `dev/kabihasnang-ligaw-dashboard-r5`, inspect live remote state, and continue until every achievable gate is complete. Report only concrete unresolvable blockers and required owner approvals. Do not claim release-ready without evidence.

## Authority and absolute safeguards
- **100% cloud-only.** Never write, clone, download, build, cache, export, or log to owner's PC C: or D:. Use remote GitHub/cloud CI/hosted Android runners. If no cloud runner is available, CLOUD BLOCKED; no local fallback.
- **V28 takes precedence.** Do not merge into `main`, mutate production Supabase, publish OTA, or change any release channel until V28's live production update group, runtime/channel, cumulative RC/source manifest and source SHA are verified and R5 reconciled with that actual live baseline.
- DEV → verified frozen RC → approved Android Production OTA. No unrelated edits; protect LIFE, Community Wall Posting, BUKLOD TODAY, PTT, DZAS, native metadata, and ads.
- Scope approval: preparation and safe isolated DEV fixes/tests; **production mutation remains separately gated**. Owner sign-off on art/audio and final RC is required. Never fabricate evidence.

## Already imported exact owner-provided prose
- `content/kabihasnang-ligaw/panimula.md`
- `content/kabihasnang-ligaw/kabanata-01.md`
- `docs/kabihasnang-ligaw-r5-chapter-01-living-storyboard.md`
- `docs/kabihasnang-ligaw-r5-manuscript-import-gate.md`

Preserve the user's approved prose word-for-word; compare against original user message if accessible. Never replace with prior 3-paragraph preview or regenerate. Make runtime read canonical full text; use deterministic paragraph IDs and verify beginning/end, length and hash in cloud CI. Existing storyboard uses exact prose anchor phrases; resolve to unique paragraph ranges and fail closed on mismatches.

## Complete end-to-end implementation, not documentation-only
1. Inspect the current remote DEV head, production baseline, existing R5 reader/admin/catalog/SQL, and test setup. Produce scoped diff; identify defects and fix them.
2. Wire full Panimula and Kabanata 1 into reader/catalog with secure draft vs approved visibility, offline-friendly cached reading, typography controls, retry and weak-network fallbacks. Do not unlock unapproved or unscheduled content.
3. Build a coherent premium Filipino cinematic reader and **scene-specific original/licensed** illustrations. Generate/upload art only through authorized cloud tools; if original scene art cannot be generated, leave asset gate explicitly blocked instead of substituting generic stock or rejected assets.
4. Map every illustration to verified paragraph spans. Implement lightweight, subtle **Living Illustrations**: moving leaves/dust/root glow/water ripple as appropriate; **do not invent rainfall in the moonlit Chapter 1**. No early spoilers: the missing shadow and duplicated boy's voice must appear only at the closing reveal. Father is a disembodied voice, never an on-screen ghost. Pause when offscreen/background/reduced motion/battery saver/weak network. No high-res autoplay videos.
5. Integrate Admin Panel → Kabihasnang Ligaw → Story Management with authenticated, server-enforced admin-only approve/revise/schedule/pause/resume/emergency stop; audit and RLS. One approved episode daily 06:00 Asia/Manila; previously approved/released episodes remain accessible; no unapproved drafts shown to members.
6. Secure points +2 first valid episode completion and +10 first season completion using existing configured rules and idempotent transactional ledger; separate cosmetic Story Journey. Test races/replays/unauthorized requests and no bayanihan ledger writes.
7. Audio channels music/ambient separately opt-in, silent without rights-cleared files; honor DZAS/PTT interruption and explicit resume intent. Do not synthesize harsh oscillator or add unlicensed audio. Missing audio blocks owner-approved media gate unless explicitly waived by owner.
8. Repair cloud CI Jest: inspect package-lock and Expo-compatible Jest dependency; add narrowly scoped dependencies/lock updates only if justified. Run TypeScript, 11 R5 contract checks, real Jest tests, DB migration/RLS/reward tests against isolated cloud test DB, and low-end Android device/emulator performance tests in a supported remote runner. Do not claim passes if unavailable.
9. Verify unchanged modules via scoped Git diff and targeted regression checks. Keep additive SQL unapplied to production until gated authorization.
10. Prepare complete asset manifest, provenance/license proofs, text hash, screenshot/preview links, test logs, performance observations, migration rollback plan, RC manifest and exact publish command. Mark RC **not frozen** until every gate passes. Reconcile V28 first, then freeze verified RC; never auto-publish unapproved R5.

## Report contract
Do not return with generic advice or repeat old checklists. Return only when a material owner decision or truly external blocker prevents progress, or when all pre-release gates are demonstrably passed. Report exact completed commits, tests, asset approvals, V28 status, remaining blockers, and one concrete manual action if any. Do not call this OTA READY while required gates are blocked.
