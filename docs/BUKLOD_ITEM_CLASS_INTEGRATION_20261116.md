# BUKLOD Kingdom — Living Character + Visual Item Atlas (isolated DEV candidate)

## Verified baseline and current limits

This archive is a **DEV source bundle**, not a completed OTA or deployed app. Its existing repository counterpart is `faust-0612/BUKLOD-Rork`, canonical `main` source baseline checked at `1aebc901e77089c7f3e926c76dfff4a4a8e34972`. The previous isolated Treasury-source branch is `dev/kingdom-item-badge-journey-20261116` (commit `2fe337e7ea330688e208a800b124b3b7dffbbbb0`). This archive adds local code, tests, 7 distinct reference-sheet crops, 42 optimized item thumbnails, and a descriptive 20-class catalog **on top of** the concept. Nothing in the archive is assumed to have been merged, deployed or published.

Important: There are **7 distinct class posters** in the 10 screenshot files available, with repeated Light/Bond/Crystal images; these seven are Book, Light, Bond, Crystal, Chest, Relic, Badge. They contribute 42 visible item images. The discussion mentions eight previously generated groups, but its eighth visual/name was not available. A **Weapon Class** has therefore been assigned *provisional planning placeholder* status, not claimed as pre-existing finished art. The twelve explicitly requested expansion classes are modeled with six names each, but none of their art is in this archive. `7 art-supported + 1 unverified placeholder + 12 requested concepts = 20 class definitions / 120 concept entries`. This is **not** 120 finished images or actual game items.

## Item economy and entitlement boundaries

- **Canonical** Character V2, individual character levels, official Circle Rank, BUKLOD lifetime Points, QMP/Finance, AdMob impressions and game-only server Shards remain authoritative and unchanged.
- Existing canonical Character World contains 13 × 20 × 5 story objects (1,300 catalog entries) and is separate from the 120 **illustration concepts** here. Never auto-create an entitlement based on a matching art name.
- The experimental `Adventure XP`, `Adventure Hibla`, `Memory Dust`, `Bond` and five `Adventure Relics` are **local account-character-scoped story preview values**. They have no server ledger and cannot be redeemed, traded, or transferred. Display this boundary in every reward screen.
- Character choices create non-credit branch endings, daily practice is deduplicated and has a forgiving streak, unique fragments craft five local relics, and duplicates are exchanged for local-only Dust and missing album relics. Provisional item-design metadata never auto-mints those relics.
- Actual cross-user trading is **OFF**. If built later, only *separately server-minted, verified spare cosmetic duplicates* may participate in an escrowed, consent-based, atomic in-app exchange. Never allow badge, personal achievement, active equipped item, Shards, BP, QMP, cash, or user data to cross owners. No real-money purchase, random paid chest, unverified transfer or underage bypass.
- Season cosmetics and optional rewarded ad cosmetics may never grant advantage in official mastery, exams, real-world QMP or redemption. Avoid any guarantee of a live ad impression.

## Requirements, uses and transparency

The Atlas shows every concept's **target acquisition condition**, **proposed use**, **trade policy**, **art-source status**, and explicit non-implementation notice. Actual requirements are **not live** until server-authored policies are separately approved, implemented, tested under RLS, and QA'd. If/when made live, each card must expose exact source event, required progress / next eligible step, reward effect and duration, whether bound/stackable, equipped state, receipt ID, and appeal/reconcile path. Secret challenges may hide their content but must reveal player safety/fairness boundaries and transparent general category.

| Class grouping | Rule and gameplay | Current status |
|---|---|---|
| Light / Book / Relic | Story choices, knowledge, exploration; unlock journal scenes and practice-only visuals | Owner-supplied reference art; gameplay policy proposed |
| Bond / Badge | Mutual co-op choices, verified unique mastery; visual titles and duo scenes, never purchasable social rank | Owner-supplied reference art; policy proposed |
| Crystal / Chest | Deterministic fragment crafting and milestone cosmetic choices, no undisclosed random paid loot | Owner-supplied reference art; policy proposed |
| Weapon | Free strategy/puzzle-themed cosmetic gear | Eighth pre-existing class **NOT verified**, provisional only |
| Armor, Accessory, Evolution, Companion, Skill, Crafting | Free equipment, cosmetic skill animations, NPC encounters and noncredit transforms | Six classes specified; art/entitlements not implemented |
| Kingdom Building, Exploration, Quest, Season, Prestige, Profile Cosmetics | Room decoration, map scenes, album, seasonal self-expression; no pay-to-win | Six classes specified; art/entitlements not implemented |

## Source integration

Copy the archive's paths into an **isolated feature branch** based on current canonical main, after comparing the current production identity, open RC and pending work. Respect existing protected-feature locks, update the V2 scope manifest with exact changed paths and changed behavioral tests, and avoid wholesale overwriting of a newer Character V2 or Kingdom branch. `src/app/games/character-experience.tsx` is a **new isolated route**; do not automatically replace `src/app/games/legacy.tsx` or the 13-station map. The Gallery component is imported only from the new route and renders one class's six images at a time. Keep any pointer to this new route behind an intentional navigation entry after approval; do not silently create one in production.

The screenshot tiles were cropped **only** from reference images; before final release, replace them with approved high-resolution source assets if available. They currently contain image-rendered captions; UI renders selectable names separately for accessibility. The runtime bundler must verify the `.webp` assets in Android Expo native and Web bundles; Metro/Expo dependency resolution and actual Android rendering are **not** verified here.

### Acceptance and release gates

1. Run focused Node behavioral tests and TypeScript/JSX syntax checks in this archive, then full repo TypeScript, Kingdom regressions, character persistence tests and existing protected-feature gate from the canonical clone.
2. Verify the two account identities and switch back to the same character after switching, offline save/replay deduplication, resume, failures, dark mode/contrast, reduced motion, memory/audio cleanup, and 3G navigation.
3. Validate no new account/server grants, misleading ownership visuals, ad placement changes, or exposure of Finance/QMP earnings. Validate user consent and server escrow before ever exposing trade.
4. Freeze DEV → staging RC, verify exact signed Android package/runtime/OTA target and web bundle, and only then consider Production OTA. No release is authorized by this design reference, and physical device checks cannot be presumed passed.
