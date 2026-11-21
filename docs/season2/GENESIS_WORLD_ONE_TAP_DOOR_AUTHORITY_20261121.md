# BUKLOD Season 2 — One-tap door authority (DEV only)

## Canonical illustrated entry map
- Preserve the approved **BUKLOD Community Map: A Welcoming Valley** local WebP exactly; original 14 gold-icon landmarks and coordinates remain unchanged.
- Add a separate **Character Kingdom** map portal at normalized (0.650, 0.150), near the high plateau; **Empire Arena** retains original top-right Arena landmark (0.806, 0.224). The extra portal is an overlay, not an altered or generated building. The two must be visually reviewed for exact alignment on Android before final visual acceptance.
- All hotspot taps call the corresponding existing route immediately (debounced to avoid duplicate pushes). There is **no Enter button**, no required downward scroll or two-step selection. Zoom is optional.
- Genesis startup and legacy Home re-entry both resolve to `/buklod-map`; production remains the existing Wall first view and its legacy navigation.
- Map's first-view ad remains present, collapses on non-fill/consent under the original ad component; audio remains opt-in and yields to media/calls/ads.

## One district owns each route

| Primary door | What belongs inside | Canonical entry |
| --- | --- | --- |
| My Place / Family Homes | Personal Home, profile, BP view, radio, reminders, budget | `/personal-home` |
| Community Wall Plaza | Public Wall, Reels, invites | `/buklod` |
| Connect Hub | Messages, calls, notifications | `/messages` |
| Cluster Village / Bayanihan Hall | Cluster, organization, sub-organization, community discovery, Bayanihan | `/clusters` / `/bayanihan` |
| Learning Grove / Children's Story World / Faith Center | Learning, progression, Season Journey, children's stories, optional Bible/Life | `/learn` |
| **Character Kingdom** | 13 characters and realms, progression, collectibles, game practice | `/games` |
| **Empire Arena** | Separate embedded in-app landscape combat/practice, future ranked authority | `/games/empire-arena` |
| Market Street / Business District | Market, business, economy guide, qualified community contributions | `/profile/buklod-market` |
| Government Hall / Health Center / Support Center | Focus Apps (government and education), health, family, help, support, settings | `/profile/focus-apps` |

## Door rules
1. The drawn location is a navigational doorway, **not** a second version of a feature. Its existing Expo Router page and server-side authorization stay authoritative. A scope wall post is created and moderated within existing Wall/scope routes, not as a new independent wall app.
2. Government uses the existing **Focus Apps** door; **Education/Classroom**, Health and Family remain inside their existing Focus App/workspace destinations. Do not duplicate the native bottom tab.
3. Character Kingdom is not Empire Arena. Do not nest Arena under Kingdom or route Arena back to Kingdom; Arena returns to World Map. Character BP eligibility / item verification and Arena ranked Diamonds remain separate authorities.
4. Show Faith OFF must hide faith-only doors and preserve non-faith character/item paths. Protected routes must still enforce their own access; hidden-map shortcuts do not grant entitlements.
5. The complete directory remains accessible below the map but optional; no normal navigation requires scrolling. Future assets may add labels or distinguishable shapes, but do **not** replace the approved landscape without new approval.
6. Additional unfinished experiences (lot/house/cluster stages, Arena live matchmaking, transaction-safe BP/item economy, government workflows) stay behind current implementation/authority gates. A doorway is not evidence those backends are complete.

## Release boundary
Isolated source-only change. No production APK/OTA, main merge, live Supabase schema migration, ledger mutation, or staging OTA publish. Source static checks are not physical Android, AdMob-fill, or live PvP verification.
