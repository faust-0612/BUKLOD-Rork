# BUKLOD Navigation V2 — source-derived screen inventory (snapshot)

> Snapshot only. Inspected repository tree `114385a5858298116013e2e78d4f06e7f8db168f`; `truncated=false`. This is a source inventory, not a statement that every route is currently visible, authorized, functional, installed, or released.

## Repository scope

- Source: `faust-0612/BUKLOD-Rork`, branch `dev/navigation-v2-staging-parity-20261113`.
- **366** TypeScript/TSX files under `src/app/`; some are layouts/route helpers, not unique user pages. The actual user-visible feature catalog must be narrower.
- Canonical global destinations: **Home /hub, Cluster /clusters, Wall /buklod, Connect /messages, Profile /me**.
- Separate scoped workspace: Cluster/Organization Home, Community, Connect with scope/membership authorization.
- Profile contains user/role-specific Focus Apps; these must remain role-gated and not be surfaced in unscoped offline search.
- Legacy IGPAT files still exist as historic route references; IGPAT must remain absent from new discovery/navigation/creation. Do not delete historical data or re-enable.
- Existing platform-specific routes and Android/native share target require explicit staging binary compatibility before changing native GIF handling.

## Source group counts (files, **not** active feature counts)

| App directory | TS/TSX files |
|---|---:|
| `admin` | 88 |
| `profile` | 35 |
| `games` | 17 |
| `organizations` | 17 |
| `clusters` | 16 |
| `scope` | 15 |
| `mzb` | 12 |
| `personal-home` | 11 |
| `(tabs)` | 9 |
| `church` | 9 |
| `faith` | 9 |
| `account` | 7 |
| `drawer` | 7 |
| `bible` | 5 |
| `formation` | 5 |
| `igpat` | 5 |
| `life` | 5 |
| `system` | 5 |
| `(auth)` | 4 |
| `bayanihan` | 4 |
| `connect` | 4 |
| `leader` | 4 |
| `settings` | 4 |
| `churches` | 3 |
| `giving` | 3 |
| `points` | 3 |
| `prayer` | 3 |
| `privacy` | 3 |

## Critical functional journey mapping

| User journey | Canonical entry | Safeguard |
|---|---|---|
| Password & recovery | `/settings` → `/account/security` | Existing auth/session guard |
| Notifications | `/notifications` | Exact item deep link + read state |
| Support / reports | `/support/live` | Authorized support cases; no entity-less moderation form |
| Public Wall | `/buklod` | Privacy/RLS and active composer state |
| Personal Connect | `/messages` | Private message scope, calls/PTT |
| Cluster access | `/clusters` | Membership and active workspace identity |
| Health Center | `/profile/buklod-health` | Current per-feature gates; no health data leak |
| Smart Drawer | `/drawer` | Account-scoped private files |
| Offline help | `/settings/navigation-help` | Optional reference, no mandatory tutorial |
| Personal profile | `/me` | Non-hideable Settings gear and customization isolation |

## Executable route integrity

`scripts/navigation-v2-route-audit.mjs` checks all Settings and offline feature finder links against actual Expo Router file paths. `tests/navigation-v2-route-audit.test.mjs` includes positive and adversarial route-resolution checks.

**Not yet proven:** actual deployed live Android fingerprint, currently installed staging-user APK/OTA, all role flows, large-font/IME behavior on physical devices and comprehensive first-time task metrics. Staging OTA MUST remain blocked until these are verified.
