# BUKLOD unified RC reconciliation (NO PUBLISH)

Status: **UNPUBLISHED SOURCE / RELEASE HOLD**. Published production main SHA afdeb8f4ad3034328235a77342720c04212106c2 remains unchanged.

Sources: Points R3 + Kingdom R13 + Character 9d6eed8a275b67cef8e3f3bfc65734bc65fb4e72 (PR #570); BSOC Live Support and personnel 8af6ed3d005e2a2ac260a696afb2b5c7b2ba238a (PR #571); Cluster keyboard-safe editor PR #548, verified to share its original source blob with current main. Dashboard combines both Points and BSOC rows.

Six BSOC source migrations reconciled against the live Supabase migration ledger:
- Direct case chat/evidence: 20261107144824_bsoc_direct_support_chat_evidence.sql (already applied as version 20261107144824).
- Notifications: 20261107150723_bsoc_support_notifications_v1.sql (already applied as version 20261107150723).
- Personnel invites: 20261107154005_bsoc_personnel_invitation_codes_v1.sql (already applied as version 20261107154005).
- FK indexes: 20261107151636_bsoc_support_fk_indexes.sql (already applied as version 20261107151636).
- Additive DB nonce default: 20261108014000_bsoc_chat_nonce_default.sql (live column default already gen_random_uuid(); migration history entry absent).
- Support counts RPC: 20261108015000_bsoc_support_counts_v1.sql (live RPC exists; migration history entry absent).

Do not run applied migrations again. The final two scripts require schema-diff and migration-ledger resolution before promotion.

Release blockers:
1. Kingdom 39 game interiors remain local gameplay previews, not server-verifiable victories or safe BP/Character XP/item/badge awards. Legacy client win-claim RPC stays revoked.
2. New Points and BSOC SQL migrations must be reconciled against the actual live Supabase migrations ledger and previously manually applied BSOC objects before any schema application.
3. Authenticated Points earn-claim-ledger-character and BSOC member-agent message, screenshot/video upload, notification and staff role readiness E2E must be demonstrated.
4. Android installed V28 package org.mzbministry.buklod, runtime 1.3.2, EAS Main project 23dad7d0-389a-406e-8dec-08965dab85d8 and exact compiled update artifact must be frozen and verified. Owner waived physical device smoke only.
5. Main Expo Hosting web must be built and verified from exactly the same audited RC; avoid confusing Classroom or QuickCheck Vercel projects with BUKLOD Main.
6. Centered small share card, music/audio in posts, photo/post animation and proactive welcome/birthday/holiday/story-release notifications are not confirmed merged here; cannot be promised live without code and tests.
7. Android Wall original transfer PR #515 diverges from current main renderer; it cannot be safely overlaid without three-way review.
8. No main merge, database migration, Android OTA, Expo web deploy, Vercel production promotion or app-binary build is authorized by this source integration.

Current main Ads, Wall, SOS, KL, sponsor and desktop work is inherited from the published baseline without overwriting it.

## Public Wall music and motion source reconciliation
Music source branch: feature/wall-music-motion-20261108. Uses active library, explicit playback, optional post-creative metadata, scoped audio focus, reduced-motion support. Supabase ledger confirms the exact music migration 20261107171413 already applied live. Do not reapply it or imply new app frontend has been published.

## Centered compact post Share dialog
The existing internal Share post destination modal is changed from a bottom-aligned max-82% sheet to a centered max-460px, max-72% dialog. Long recipient lists scroll inside the card. Outside-tap dismissal and existing authorized backend share-count behavior remain unchanged. Actual device pixels are skipped, not verified.
