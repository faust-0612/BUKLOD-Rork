# BUKLOD Kingdom — Character Assets Library Integration (DEV only)

Source: user Library `/Buklod Character System Assets`; inspected 30 PNG posters in that folder. Current canonical GitHub `main` baseline SHA `63ccd4b58ff02ff3c1535a1e05d3097fa8323c61`; note **this is repository source identity, not installed Android OTA evidence**.

## What is integrated in this candidate

- **120 labeled conceptual item designs across 20 authoritative classes** from the *Complete Item & Reward Collections* reference poster. Every class has exactly six matching item designs and dedicated optimized, offline static WebP sheet. A class sheet is 528×300 pixels containing six 176×150 icon cells. This is 20 small images, **not 120 separate image decodes**.
- Direct artist-grade crops for Armor, Accessory, Character Evolution, Companion and Crafting from the corresponding individually authored Library posters; fallback class/item images from the authoritative 20×6 board, preserving semantic item-to-name pairing. Skill relies on the 20×6 poster to avoid caption cropping.
- **Classic collections** remain separate: Light, Bond, Crystal, Book, Chest, Relic and Badge: 42 additional thumbnails from user-provided screenshots. The earlier seven classic classes and new 20 core classes are independent reference collections to avoid duplicate or missing visuals.
- A new `/games/item-atlas` route shows 20 core class choices, six item visuals for the selected class, each item's target requirement, use and trade rule, plus a Classic tab. A new `/games/character-experience` route embeds the user-character-scoped, noncredit Living Adventure story, Bond, relic, offline craft, tier badge and ascension preview. Both are accessible via intentional entry controls from existing Kingdom Hall.
- No new native package. All asset `require()` calls are deterministic and statically analyzable by Expo Metro. Only the selected class sprite is mounted, no network/image CDN request, no per-scroll sprite download or asset-time API round trip.

## Exact reward/financial boundaries

This is a **DEV prototype**. The 120 image variants are **visual concepts**, not the same thing as the production `13 characters × 20 levels × 5 story objects` canonical 1,300 distinct collectible definitions. Existing server-issued Story Relics, Character V2 levels, Circle Rank, BP, server Shards, AdMob, QMP, finance and withdrawals are unaffected. The local Adventure XP/Hibla/Memory Dust are nonredeemable private device previews. Current class visuals **never** imply earned inventory. Cross-user trading and conversion of unique earned badges, Shards or BP are OFF.

Future production item grants require server-authored verified challenges and ledger receipts, authenticated/RLS ownership, atomic idempotent grant/claim and anti-farming, cancellation/account switching, permanent per-character equipment storage, reversible trade consent with server escrow only for separately minted verified spare cosmetics, and data/financial isolation. An artwork upload cannot be used as entitlement proof. No monetization/premium pass is activated here.

## Asset provenance

- `content/kingdom-item-atlas-art-provenance.json`: each class's original owner Library poster identifier, SHA-256 hash of its optimized WebP sheet, artwork size and exact item order.
- `content/kingdom-item-atlas-core-v2.json`: 20 class definitions, each with item names, proposed requirements and uses. All award/trade feature flags are disabled.
- `assets/images/kingdom-item-atlas/*.webp`: actual local static image assets for the new 120-item UI.
- `assets/images/kingdom-classes/*.webp`: original 42 classic legacy thumbnails + seven class posters, unchanged from earlier local prototype.

## Acceptance / release status

Source and focused tests can validate correctness and image provenance. Full-app `tsc`, protected scope gates, Expo Android/Web bundles, real device visual/performance verification and exact Expo staging release identity need canonical full repository and connected build environment before release. No RC, staging OTA, production OTA or Supabase mutation is claimed. BUKLOD mandatory AdMob/dashboard/nav regression protections remain required before any publication.
