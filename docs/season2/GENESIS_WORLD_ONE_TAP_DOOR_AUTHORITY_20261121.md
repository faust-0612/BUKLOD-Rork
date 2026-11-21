# BUKLOD Season 2 — owner-approved world and one-tap door authority (DEV only)

## Owner-approved entry map
- The current visual authority is **BUKLOD Season 2 Entry Map** (landscape 1672×941), not the superseded **Welcoming Valley** reference. Its optimized, locally bundled WebP is at `assets/season2/genesis/world/buklod-season2-entry-map-approved.webp`.
- Twelve **on-image labels** are preserved. Interactive 44 px hotspots are UI overlays; images are not repainted by an assistant bubble.
- The moving selected-character guide is a **separate bottom dock outside the map ScrollView**, never over the map. It waves when reduced-motion is off and offers one-tap routes plus a local privacy-preserving keyword guide; it is not a remote LLM or voice recognition service.
- On compact landscape screens, first-view AdMob occupies a side column beside the map. It is not moved out of the initial viewport; the guide remains below. The destination directory underneath is optional.
- Map/secondary world artwork is local and decodes offline; retained existing V2 backgrounds serve as the fallback in secondary worlds. Neither map nor artwork creates BP, QMP, Diamonds or unlocks.

## Twelve primary landmarks

| Visual label | One-tap destination | Authority |
| --- | --- | --- |
| Character Kingdom | `/games` | Character game + item systems |
| Empire Arena | `/games/empire-arena` | Separate combat game with server-gated ranked authority |
| Knowledge Sanctuary | `/learn` | Learning; opt-in Bible/faith subfeatures |
| Community Village | `/season2/community-village` | New village visual hub; Cluster/Org existing routes remain authoritative |
| Community Hall | `/buklod` | Public Wall, Marites, Reels |
| Connect Center | `/messages` | Messaging, calls, PTT |
| Marketplace | `/profile/buklod-market` | Business and transfer-only BP commerce |
| Bayanihan Center | `/bayanihan` | Qualified community projects and contributions |
| My Home | `/season2/my-world` | New individual Lot / House visual hub; existing household routes remain authoritative |
| Focus Apps Center | `/profile/focus-apps` | Government, Health, Education, Family and role-permissioned tools |
| Achievement Hall | `/points/progression` | Circle Rank and achievement progress |
| Life Center | `/personal-home/reminders` | Accessible personal planning and life tools |

**One tap** means tapping a landmark immediately invokes the registered Expo Router destination. No mandatory scroll, second-card selection or `Enter` action. Duplicate pushes are guarded by a 650ms client tap bound. Fine zoom remains optional and touch targets respect 44dp minimums. The final physical-device target/coordinate review is an outstanding release gate.

## Village and Home submaps
- **Community Village**: Village Cluster, Organizations, compounds, development yard, livelihood, Bayanihan; stage-1 background `buklod-community-village-stage1.webp`.
- **My Home**: independent Lot, House, garden, family, identity, personal tools; stage-1 background `buklod-my-home-stage1.webp`.
- **Three independent development tracks** (in canonical `/Buklod V2/buklod_assets_catalog.json`): `LOT_L01–L10`, `HOU_L01–L10`, `COM_L01–L10`. Each Level has Materials → Posts/Foundation → Framework → Structure → Finishing. Permanent Levels 1–10 lead into unbounded Mastery, not a second seasonal reset. Circle Rank grants prestige but never gates property levels.
- **Safety**: the current level selectors are clearly labeled visual **previews**; local material-look selections are stored per user/world, not written to a shared scope. Actual saved level, asset ownership, build costs, time, Development XP, material availability, neighbor lot permissions, construction concurrency and infinite Mastery are **not yet server-backed in this DEV implementation**. The 30 catalog PNG paths are only metadata; do not dynamically `require()` absent files or pretend those levels have been animated.
- No business or trade mints BP. Verified participation can legitimately earn BP; buying/selling/trading is a transfer of pre-earned balance with no lifetime Circle Rank duplication.
- One official Genesis Season 2 theme; structural material previews do **not** expose alternative seasonal themes.

## Authority and privacy
All route destinations retain their own server permission checks. Public posts, private scopes, government Focus Apps, finances and role access are not inferred from map selection. Show Faith off still permits generic Learning and non-faith development. No new native SDKs, subscription charges or production data mutations are introduced by the visual changes.

## Release boundary
**DEV source is implemented, not staging OTA verified.** Isolated `dev/season2-village-home-guide-20261121` only; **Production APK, live OTA and database remain unchanged**. Mandatory gates before staging release: full Android UI and 44dp hotspot rendering on actual screens, first-view AdMob fill + dashboard navigation performance, error/no-fill transitions, offline assets, auth/scope/Show Faith regressions, native runtime compatibility, and signed/verified server progression schema before any real upgrades. No RC or Production publish from this branch.
