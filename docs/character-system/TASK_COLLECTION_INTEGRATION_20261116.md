# Character System task, badge and collection wiring — November 16, 2026

## Source of truth

This feature belongs to the main BUKLOD Character System. Kingdom is a consumer of verified character achievements and cosmetic/equipment entitlements; it is not an independent XP authority.

The current source has a complete 13-character by 20-stage by 5-item catalogue: 1,300 named tangible story objects, plus a separate 469-badge name registry. The 1,300 item artworks are NOT yet ingested or mapped. The new Character Tasks & Collections page displays text/icon fallbacks and does not fabricate ownership or claim that artwork is installed.

Existing authorities remain unchanged:
- per-user and per-character XP/levels: private character-progress-v3 checkpoints plus authenticated selection V2 RPC;
- permanent account Circle Rank: lifetime verified BP only;
- core Character collected/equipped records: core collectible-state and redeem/equip RPCs;
- Special Character task badges: special-collectibles-v2 RPC with verified public Wall events and requirement snapshots;
- Kingdom Shards, game practice, finance, AdMob/QMP and character loadouts: distinct server-owned ledgers.

## Implemented in DEV branch

- New /points/character-collections view linked from Circle Rank progression; read-only, no points, award or inventory write operations.
- Character selection shows the saved per-character level and does not transfer XP when switching preview tabs.
- Exactly the 5 catalogued items at each of 20 stages. Core item OWNED appears only for a server-confirmed redeemed item ID. Special badges shown as EARNED only from server awards; they are NEVER substituted for the five story objects.
- Level unlocked, story object owned, badge earned, stage mastered and Kingdom reward remain separate status classes.
- Existing Special task requirement JSON is translated to readable tasks; public Wall can be opened directly. Other task activity types are NOT falsely credited.
- Locked Special characters: unlocked characters plus at most the next locked preview, future identities hidden.
- Account change and stale RPC protection; detail requests invalidated when the account or selected Character changes. No extra polling, no AdMob changes.
- Deterministic image key and manifest validation helper prepared for the upcoming uploads.

## Art intake protocol

Canonical image key = phan:L01:I01 (character, 2-digit level, 2-digit item).
Canonical object path = character-collectibles/phan/l01-i01.webp.

Use script: node scripts/validate-character-collectible-art.mjs PATH_TO_MANIFEST.json

Manifest format = JSON object with version 1 and items array, exactly 1,300 records. Each record must have key, path, SHA256 hash (64 hex characters), width and height (integers, 160..4096). Validator rejects missing/duplicate/unknown slots, paths, hashes or dimensions.

When all the images are in ChatGPT Library:
1. Inspect each image and preserve provenance. Map every artwork to the canonical character, level and item index. Do NOT guess from filename alone or OCR labels if ambiguous.
2. Normalize image orientations, transparent background if appropriate and thumbnails to compressed WebP. Hash all outputs and generate the manifest.
3. Only after completeness verification, publish static public artwork to a trusted asset CDN, not a single massive Expo OTA. Use cache headers and immutable URLs. No personal data in asset paths.
4. Build renderer integration using the generated checked manifest; fallback gracefully if offline, missing or corrupted. Prefetch only near-visible items; do not reload every tab switch.
5. Verify Android display/contrast, low-memory behaviour, fast scroll, image cache/offline and the exact OTA runtime before RC promotion.

## Required server-side tasks for a subsequent gated release

Current Special badge requirements are primarily meaningful public Wall activity. They do not implement cross-app Bible, Formation, quiz, service, mentoring or attendance requirements yet. Before enabling automatic story-item awards:

- Each task must have a verified source (e.g. accepted Bible completion/quiz answer, approved Formation or event attendance), immutable event id, authenticated owner, character attribution snapshot, activity timestamp and idempotency key.
- Use server-side event adapters only after reviewing individual authoritative tables and anti-farming limits. Replays, refreshes, fake posts, duplicated events, unverified offline actions or ad views MUST NOT award items.
- Implement a private, account-isolated per-character story ownership table with unique (user_id, character_id, level, item_index). No client INSERT, and no client-driven reward grants.
- Publish one efficient authenticated RPC for per-character task progress, earned objects, stage mastery, badge identity and display/equip state; all read results must originate from committed awards.
- Stage Mastery requires all five verified items. Badges are accomplishment records, not stand-ins for tangible items. No duplicate BP/BCU/Shards for claiming or showing.
- Kingdom reads entitlements; game preview/play only earns local non-credit practice until server-verified scoring is approved.
- Preserve every existing core/special award, XP checkpoint and historical record. Any migration/backfill must be idempotent and separately audited.

## Release gates

DEV only. No DB DDL applied, no staging or production OTA, and no changes to hash-locked Character Studio visuals, AdMob, native builds or live points. Verify source integrity, TypeScript, authentication/account isolation, rank gates, 1,300 unique keys, 469 badge registry, backend RLS, task deduplication, stage logic, existing equipment/regression tests and short-window ad/navigation performance. Publish only verified RC through the normal DEV -> RC -> production process.
