# Kabihasnang Ligaw — Admin approval packet for 23 October 2026

**Status: READY FOR HUMAN CONTENT REVIEW, NOT APPROVED, NOT OTA READY.** This packet identifies drafts eligible for review and never bypasses the server-side approval workflow.

## Pending complete manuscripts
| Order | Type | Canonical manuscript | Title | Content | Admin action |
|---|---|---|---|---|---|
| 0 | Panimula | `content/kabihasnang-ligaw/panimula.md` | Ang Daigdig na May Sariling Alaala | Complete; in R5 manifest as draft | Show in Story Management pending queue; review full text, verify hash, approve or request revision |
| 1 | Kabanata 1 | `content/kabihasnang-ligaw/kabanata-01.md` | Ang Gabi ng Pag-ahon | Complete; in R5 manifest as draft | Show in Story Management pending queue; review full text, verify hash, approve or request revision |

Both manifest records currently have `status: draft`, `approvedAt: null`, `mediaGate: missing`, and placeholder `releaseAt: 2099-01-01T22:00:00.000Z`. **Do not change these to approved by editing a client JSON file.** Approval must be authenticated, authorized, server-persisted and auditable.

## Target schedule — conditional
Owner says launch is tomorrow, 2026-10-23 in Asia/Manila. 06:00 Asia/Manila corresponds to **2026-10-22T22:00:00Z**. Set release times only through the validated server-side Admin scheduling workflow after approvals, content/media gates, and OTA release gates. If the actual production deploy is later than the scheduled time, do not backdate approval or claim it went live.

## Non-approvable outlines
Kabanata 2–30 are not complete manuscripts and must not appear as content-complete approvals. Keep as outlines; produce full chapters under separate editorial review.

## Required UI + server fix
Story Management must query actual pending draft rows from the backend, render each item with full manuscript preview and status, and expose approve/revise/schedule actions only for authorized system admins. Each action must show pending, confirmed success, or actionable failure, prevent duplicate taps, preserve server-committed success across navigation failures, and log audit entries. No optimistic approval. If R5 manifest is bundled but DB has no draft records, add an **idempotent, authorized cloud-only draft import** with content hash validation, then confirm queue rows exist. Do not silently import to production.

## Pre-release blockers
- Verify V28 live production cumulative baseline and reconcile R5.
- Verify backend draft import, admin visibility, RLS, approval workflow, and scheduled release.
- Owner approve/waive missing illustration and licensed-audio gates; never assume approval.
- Cloud CI tests including TypeScript/Jest, security/reward checks and low-end Android; freeze exact RC only after passes.
- Publish OTA only with explicit authorization after every gate passes.
