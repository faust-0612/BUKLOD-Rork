# BUKLOD Character Collectibles — Library intake and release evidence

Date: 2026-11-16. Branch: codex/character-task-collection-foundation-20261116.

## Image source

The user-designated folder is exactly:
  /Buklod Character System Assets/Collectibles

Ten PNG collection boards (batch 01 through batch 10), 1055×1491 pixels each. Each board represents all 13 characters at two successive levels and five objects per level (130 objects). 10 × 130 = 1,300 unique item locations.

All originals were preserved. The processed deliverables were saved to:
  /Buklod Character System Assets/Collectibles/Processed

The visually cleaned stored ZIP is 8.06 MB: BUKLOD_Character_1300_Collectibles_Ready.zip and contains
1,300 256×256 WebP crops (approximately 7.8 MB in total), a SHA256 source/crop
manifest, published-v1.json, README and an offline zoomable index.html gallery.
No ambiguous filenames were assigned to stage/character based on order of upload:
batch numbers were inspected on the original image headings before extraction.

Native icon source resolution is roughly 73–85 px wide by 28–45 px tall after trimming embedded caption fragments. Upscaling
cannot genuinely increase source detail. Render approved item titles from the
canonical Character World catalogue as normal high-contrast UI text.

## DEV app wiring

- /points/character-collections is part of Character System, linked from Circle Rank.
- Saved levels are read from server-authoritative Character V3, not inferred from art.
- All five story objects per stage retain a stable id (character:LNN:INN).
- Original core inventory remains from the existing core redeemed item RPC.
- Special task badges remain from the existing special badges RPC.
- Special tangible story items use a distinct, new, authenticated task RPC only
  when its additive migration is live; previous badges survive if that RPC fails.
- Server evidence is required for OWNED. Uploaded artwork never grants ownership.
- Image publication gated by public bucket buklod-character-art-v1 and a verified
  published-v1.json uploaded last. Before the marker exists, fallback icons render.
- Thumbnails use expo-image memory/disk cache, at most five stage images at once.
- Item tap opens a full-screen pinch/pan and zoom-button modal with crisp titles.
- Failure/offline uses a lightweight fallback with no repeated navigation blocking.

## DEV backend logic (not applied)

The new additive migration is
  supabase/migrations/20261116120000_character_task_story_art_v1.sql

It creates a public static-art bucket with no client upload grants; private
per-user and per-character server-event and story-award tables with RLS; a trigger
that snapshots the active character from already-validated public Wall events;
and a separate authenticated Special story-item read RPC. Item grants are unique
on (user_id,character_id,level_no,item_index). Replaying existing events and
repeated reads cannot mint duplicate rewards. Current five evidence tasks per
level are meaningful posts, meaningful comments, eligible reactions, eligible
shares and distinct active weeks plus the first four items. Required character
level is checked against server-restored progress.

The existing 20 task badges per Special Character are NOT converted into five
physical items; they remain separately verified. Existing Core items, Circle
Rank, BP, finance/QMP, Kingdom Shards and Kingdom game scores are untouched.

The DEV backend now includes a separately audited cross-feature task adapter
for existing server-CLAIMED BUKLOD Points events: daily Bible reading,
devotional, Formation/learning, Bible quiz, scope attendance and eligible
prayer responses. The existing BP ledger has a member SELECT RLS policy and
no member INSERT/UPDATE policy, so these credits cannot be fabricated by a
normal app client. Unclaimed or pending credits do NOT count.

The Character is snapshotted when the corresponding Points ledger event is
first written, before a delayed claim; subsequent claim-state updates flip
verified=true without transferring it to a newly selected Character. Future
records accrue only after this migration (historical credits are intentionally
not backfilled against the wrong Character). Task items 1–4 can be earned via
Wall activity OR eligible cross-feature tasks, with stage 5 requiring distinct
verified activity weeks plus the previous four verified items.

Mentoring and any remaining task families still need source-specific
backend verification before being awarded; clients cannot self-report
completion for Character credit.

## Deployment gate

No live Supabase migration, no public image-object upload, no staging OTA and
no production OTA in this DEV work. Supabase Storage cannot read a ChatGPT
Library folder directly: its verified processed ZIP must be transferred via
the secured operator-only publisher. Publisher defaults to DRY RUN; real upload
requires trusted service role credentials and explicit approval, checksums and
the full remote file count before publishing the readiness marker.

Required prior to release: native Android zoom test, Node/TypeScript quality
checks, local SQL security and idempotency tests, UI performance/AdMob/navigation
regressions, then the DEV -> frozen RC -> production OTA workflow.

The initial crop sheet included parts of embedded captions for shorter character rows. A second crop pass removed most captions and narrow adjacent-column edges; the original sheets remain unaltered. The ZIP and matching manifest were replaced in the same Processed Library folder and passed a complete CRC check for 1,304 archive entries (1,300 WebP + four metadata/gallery files). The final marker SHA256 is 2ebe18177a1a0ec38718de5ca3bb0042f6b9b36374b4b1264946c12abf8704da.
