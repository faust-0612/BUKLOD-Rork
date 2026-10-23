# Kabihasnang Ligaw — one-book final manuscript workflow

Status: approved design, not a production release.

## Canonical book
One evolving book: *Unang Serye — Ang Lupang Hindi Namamatay*, with Panimula and Chapters 1–30 in sequence. Existing live Panimula and Chapter 1 are immutable baselines. Drafts are not final chapters. Once each chapter is approved, archive its exact text and checksum in the book's append-only release history; do not overwrite a released chapter. A whole-book export is assembled from the final approved snapshots, never from unapproved drafts.

## Reader access
Members can access only chapters unlocked by server-validated schedule and approval. Locked manuscript text must not be shipped in public bundles or returned by member APIs. An authenticated active system_admin (Faustino's authorized account) can preview locked chapters without bypassing the permanent edit lock. Never identify admin by a client-side name string.

## Editing and release
Remove the redundant standalone approval desk only after its required preview/music functionality has been preserved in the system-admin reading experience. Prior to release, draft changes and review are allowed. On release, freeze text, assets, revision hash, and approval metadata server-side; reject all update, revise, or replacement operations against released snapshots, including admin calls. Schedule alone must not expose incomplete or unapproved content.

## Archive and download
Maintain one private master book in version control, not separate repositories per chapter. Whole-book download is available to authorized admins during writing and readers only when the complete book is approved for distribution. Generate PDF/DOCX/EPUB exports from the immutable snapshots. Never use a public GitHub URL to bypass scheduled unlocks.

## Release gate
Verify live production baseline, chapter-0/1 parity, server read authorization, admin preview, audio coexistence, chapter-2 content integrity, locked/unlocked tests, and OTA compatibility. DEV -> verified RC -> production OTA. No deployment without these gates.
