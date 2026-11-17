# BUKLOD app-wide compact layout standard (2026-11-16)

Applies to every new and modified screen, modal, card, feed, profile, cluster, Bible, character, Kingdom, and web view. Reference: user-supplied BUKLOD vs Facebook Android screenshots. Density must never compromise readability, accessibility, or safe-area/keyboard behavior.

## Spacing tokens (React Native logical dp)
- 0: contiguous feed media, adjacent full-bleed sections.
- 4: icon-to-label micro gap / related metadata.
- 8: default within grouped content and between closely related controls.
- 12: compact card interior / between distinct groups.
- 16: maximum default screen horizontal gutter, not additive to child card gutters.
- 20-24: intentional major-section separation ONLY when visually justified.
- No arbitrary 30-80dp blank spacers, fixed empty heights, duplicate parent/child padding, or empty placeholder blocks.
- Feed media full-bleed where appropriate; metadata/actions get their own 8-12dp inset. Cards in feeds should not each have nested screen gutters.
- Content-driven heights by default. Minimum 44dp touch targets; preserve platform safe areas, keyboard avoidance, and accessible font scaling.

## Required implementation rules
1. Single owner for each horizontal inset: screen OR section OR card. Never stack all three unless a deliberate design exception is documented.
2. Use a shared spacing token rather than unexplained numeric margin/padding. No negative margins to hide broken layout.
3. Remove duplicated section titles, descriptions, labels, and unnecessary wrappers before shrinking fonts.
4. Do not compress story art, map controls, charts, ad creative, Bible text, character artwork, or tappable elements beyond legibility.
5. A fixed header/encouragement bar/bottom tabs must not obscure scroll content. Handle keyboard, insets, landscape, and short screens.
6. AdMob placements retain actual dimensions, consent, viewability and lifecycle. Never fake or collapse an ad slot while an ad is rendered.
7. Dark/light themes and native/web must share density intent without assuming identical pixel sizes.
8. Profile: compact rank, actions and referral panels. Cluster: compact list cards and search. Wall: edge-to-edge media, short metadata rows. Wall and Connect: note rails must use content-driven height (44dp minimum touch area), bottom-align avatar columns, and never reserve a five-line blank Note slot. Editing may use its own temporary expanded area. Reading: compact headings while keeping text readable. Character: scrollable modal, compact level grid and collectibles.
9. Any spacing exception above 24dp must include an inline reason (safe-area, image ratio, ad slot, keyboard, accessibility, or intentional visual grouping).

## Mandatory PR / OTA review gate
- Check Home, Cluster, Wall, Connect, Profile, Bible, Character, Kingdom, Finance/QMP, modal, chat with keyboard open, ads, dark mode, small Android screen, and web.
- Compare screenshot baselines before/after. Verify no clipping, overlap, inaccessible controls, or scroll dead zones.
- Verify ad presentation, first-view impressions and navigation responsiveness remain unchanged.
- Reject new duplicate padding and gratuitous whitespace; use focused regression tests and manual visual acceptance before staging OTA, then RC verification before production OTA.

This is a design policy, not proof that all existing screens have been migrated or tested.
