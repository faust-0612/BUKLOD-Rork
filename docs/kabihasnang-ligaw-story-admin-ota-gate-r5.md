# Kabihasnang Ligaw R5 — Story Admin Dashboard mandatory OTA acceptance gate

**Owner decision (2026-10-20):** The Story Admin Dashboard MUST ship in the same Kabihasnang Ligaw R5 OTA, not as a later optional phase. Keep the prior V28 production OTA as a prerequisite and follow DEV -> RC -> Production gates.

## Placement and permissions
Integrate a `Kabihasnang Ligaw → Story Management` menu into the existing BUKLOD Admin Panel (not public Community Wall and not a separate website). Discover existing admin route and authorization pattern; no guessed path. Only server-verified authorized story editors/admins may read drafts or mutate approvals/schedules. Never rely solely on hidden UI or client role claims.

## Minimum functional acceptance
- List seasons and episodes with status: draft, needs revision, approved, scheduled, live, paused.
- Open full preview with exact manuscript paragraphs, scene-matched illustrations, glossary, and optional audio before approval.
- Approve/reject with revision notes; approval attributable to authorized actor and recorded in immutable audit history.
- Schedule approved episodes for 06:00 Asia/Manila, using UTC timestamps and server-controlled release visibility; no daily OTA.
- Pause/resume individual episodes or entire season; emergency kill switch; audit all actions.
- Display delivery state, missing assets, scheduled release time, errors, and first-time reward posting failures/retries.
- Prevent publishing incomplete prose, placeholder art, missing media rights, unreviewed artwork, or unapproved episodes.
- Validate concurrent edits, timezone boundaries, duplicate rewards, revoked admin access, and weak-network retry/error states.
- Ensure no privilege escalation through client, RLS or RPC; protect existing BUKLOD point ledger.

## Release gate
Do not call R5 READY, freeze RC, or publish production OTA until dashboard, complete reader/media, secure scheduled publishing, rewards integration and regression/security tests all PASS. Report blockers without inventing completion. No production changes solely from this documentation commit.
