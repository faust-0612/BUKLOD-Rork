# BUKLOD App-Wide Theme Library + Genesis Season 2 Visual Spec

Prepared 2026-11-20. **DEV preparation only. No Season 2 production authorization.**

## User intent
1. Keep every existing app-wide theme and add all nine newly proposed palettes as selectable user appearance options.
2. Every palette should have coordinated canvas, text, cards, active actions, chat bubbles, and patterned BUKLOD header.
3. User-selected palette must remain independent from any seasonal art.
4. Season 2 artwork should have intentional linework, not flat monochrome areas.
5. Protect first-view ads, instantaneous dashboard navigation, media readability, accessibility and chat composer.

## Added user palettes
| Theme | Public header | Primary actions | Decorative accent | Canvas |
|---|---|---|---|---|
| Evergreen Social | #0D2943 | #106A50 | #A6E04C | #F4F8F5 |
| Midnight Mint | #112D39 | #0B6C68 | #70D6C5 | #F1F6F6 |
| Warm Community | #123C32 | #14684F | #DBB86B | #FAF8F2 |
| Sapphire Frost | #122D53 | #245DD8 | #24B8A6 | #F1F5FC |
| Forest Champagne | #153A31 | #17644F | #E5BD77 | #F8F6F0 |
| Royal Plum | #32253C | #794D89 | #DDA1B2 | #F8F4F9 |
| Terracotta Sand | #463932 | #A85741 | #E0A76D | #FBF7F0 |
| Graphite Lime | #17282B | #355F5A | #B4DB56 | #F0F4F2 |
| Ocean Coral | #153A51 | #116F8C | #EF9A87 | #F3F8F9 |

Existing palettes, default, AsyncStorage preference key, dark-mode detection and account/reward rules remain unchanged. New shades intentionally have readable dark primary actions; decorative highlights are not used as low-contrast body text. Header/public routes can render subtle line art with pointerEvents none; scoped workspace headers remain light for readability.

## Season 2 proposed title (not yet approved)
**GENESIS — THE FIRST LIGHT**

Tagline proposal: **Every beginning brings us closer. / Sa bawat simula, sama-sama tayong lumalago.**

Other possible final titles:
- Genesis: A New Dawn — energetic sunrise
- Genesis: Roots of Tomorrow — new life and foundations
- Genesis: Rise Together — community-first launch
- Genesis: The First Chapter — literary / story-driven launch
- Genesis: The Beginning — original owner proposal

Preferred story: beginning -> spark -> awakening -> roots -> connections -> growth. Distinct from literal Genesis 1 biblical artwork: abstract first light, thin contour threads, sprout/root lines, nodes connecting people, no inaccurate religious illustration.

## Seasonal visual palette
- Dusk / navy: #102C3D
- Growth green: #1F7656
- Sunrise gold: #E7B861
- Morning canvas: #F6F7F0
- Horizon blue: #79B8D2
- Text on dark: #FFFFFF

## Decorative art: never plain
1. **First Light**: layered horizon contour curves and fine sun-ray lines behind the Season 2 hero.
2. **Living Roots**: branching botanical root/growth traces around profile achievements, cluster status and milestones.
3. **Linked Paths**: network of gently curved paths, small nodes and concentric outlines around social community panels.

Visual rhythm: 1–2 px lines, 6–18% opacity, generous clipping, no asset download, static vector first. Avoid full-screen repeated SVGs behind long-scrolling feed cells; place bounded motifs only in hero/header surfaces.

Suggested placements:
- Home: top Season 2 hero and featured stories card
- Wall: a single season announcement/header card; do NOT stamp or tint user media
- Cluster: subtle linework in the intro header, not the fund ledger
- Connect: list header/empty-state only; never behind chat input or seen indicators
- Profile: cover corner trim, season progress card and badge borders
- Kingdom/Character: integrated season frame around progression, without changing XP authority
- Bible/KL/LIFE: an optional small chapter ornament only; preserve distraction-free reading
- Ads: untouched ad slots and prefetch/consent lifecycle, no translucent overlays

## Independent preferences
- `appearancePalette`: any global palette selected by user (existing storage key).
- `seasonalDecoration`: future setting Auto / On (when authorized) / Off; never forces a palette switch.
- `motion`: respect reduced motion; animations only if performance-safe.
- `dataSaver`: static local vectors, no network-delivered season background art.

## Release boundaries
**Production Season 2 embargo until 2026-12-06 00:00 Asia/Manila, then exact separately owner-approved SHA-bound release.** Do not automatically launch merely because the date arrives. Reference `docs/BUKLOD_SEASON2_PRODUCTION_EMBARGO_20261118.md`.

New `src/lib/buklodSeasonVisuals.ts` and `GenesisSeasonArtwork.tsx` are **UNMOUNTED design preparation**. No flags or runtime auto-activation. No changes to Season 1/Season 2 points, bonuses, ads rules, tokens, items, badges, authentication, RLS or payout logic.

## Verification gates before staged rollout
- Verify all previous and nine new palettes appear in Settings > Appearance and selection persists after reopen.
- Verify an independently overridden Connect theme and Follow Global behavior.
- Confirm header/avatar/navigation color contrast in all five tabs, scoped screens and web.
- Verify 3G scrolling, ads first-view/fill, no background updates during idle scroll, no layout shift.
- Verify Android device screenshot (light/dark), accessibility large text, keyboard safe area and device reduced motion.
- Only stage Season 2 visual shell after current Train A production prerequisite as required by embargo. No production OTA from this DEV branch.

## Decision pending
Owner can approve title GENESIS — THE FIRST LIGHT or choose another title and choose a launch hero layout. That design decision is separate from final Season 2 release authorization.
