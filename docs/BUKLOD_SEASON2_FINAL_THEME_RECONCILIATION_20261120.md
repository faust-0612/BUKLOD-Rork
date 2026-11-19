# BUKLOD Season 2: Final Theme Reconciliation

20 November 2026 · **DEV source only / not staged / not live**.

## Authoritative decision
Latest approved title: **Genesis: Let There Be Light** (Genesis 1:3).
Season-owned visual identity: galactic Creation — stars, space, planets, galaxies,
nebulae, creator-referencing first light, radiant orbit lines and luminous fragments.
The former **Genesis: The Seed of Glory** botanical/harvest identity and its
nine user-selectable palettes were **superseded**; do not merge their separate
`dev/genesis-theme-library-20261120` branch into Season 2.

Season 2 has **one official theme**. User-selected global, Connect and personal Home
color/theme overrides are not offered while the authorized Season 2 preview is
active. Saved preferences must not be deleted, migrated, or overwritten.

## Actual scoped additions
- `seasonThemeAuthority.ts`: derives cosmic Messages roles from canonical
  Genesis global roles, with contrast-safe chat bubbles, composer, tabs and controls.
- `ConnectThemeProvider.tsx`: blocks persisted Messages-only overrides in Genesis
  preview while keeping normal Season 1 behavior and storage unchanged.
- `ChatBackgroundProvider.tsx`: suppresses legacy user chat photos, gradients and
  patterns while the season preview owns visual styling, without deleting storage.
- `ConnectThemeSelector.tsx`: hides cosmetic appearance picker in Season 2 only.
- `(tabs)/_layout.tsx`: shows static clipped orbital/planet-line art behind
  the public header in the non-production Genesis preview; ordinary public header
  remains navy. No animations or runtime subscriptions were added in the header.
- Source-level regression tests added.

## Desired final seasonal visuals (not all implemented)
- A coherent cosmic world across Home, Wall, Connect, Profile, Bible/KL,
  Character, Kingdom, Collection, reward/unlock ceremonies and startup.
- Dim orbital tracer lines, deep-galaxy backgrounds, planet glow, pulsing light
  particles, premium character motion and item/rank visual reveals.
- Preserve readable body content, composer's keyboard space, ad visibility and
  first-view load, media quality and immediate dashboard/tab navigation.
- No inexpensive loop/beep substitute. Audio only with approved/mastered assets
  under existing audio focus, call, video and user-consent protections.
- Respect reduced motion, foreground/focus, data-saving and native frame budget.

## Outstanding / blockers
- This is not the complete Season 2 app-wide visual implementation: some screens
  still use legacy fixed backgrounds and will require per-screen reconciliation.
- Premium 13-character animated rigs and mastered soundtrack/SFX are not verified.
- Cinematic Kingdom and cropped premium item art are in a **separate unmerged DEV
  candidate** PR #1007; not automatically incorporated here.
- This connector pass verifies source contracts/diffs only. Node/Jest tests, Expo
  bundling, TypeScript typecheck, on-device visual/render/contrast tests, and
  Android AdMob/navigation/fill tests have not yet been confirmed.

## Gate
The seasonal preview is gated by `EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW=true`
**and** `EXPO_PUBLIC_APP_ENV` non-production. Nothing here changes the
current Season 1 live appearance. The Dec 6, 2026 embargo is an earliest
possible date, **not** an automatic release authorization. Do not publish OTA
or Play build without exact staging RC and separate owner production approval.
