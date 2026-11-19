# BUKLOD Season 2 — Zero-budget staging handoff (2026-11-19)
## Approved objective
Prepare the fully functional Season 2 Character collectible, Journey Token and Foundation Badge path for **December 6, 2026 or later** without buying another service, creating a Supabase project, increasing usage quotas, running paid native builds or modifying the live Season 1 reward system. Physical-device verification is owner-waived, not proof that it was performed.

## Free deliverables in this consolidated staging preview
- Read-only purpose and prerequisite guides for canonical **13 × 20 × 5 = 1,300** character collectibles, including the eight Special-character rank gates.
- Legacy Character screen: server-confirmed redeemed/owned vs mere level eligibility; "Show" never implicitly creates an item. Existing verified rewards remain owned.
- A separate Season 2-only mastery certification candidate under `docs/season2/sql`, and instructions for existing-backed activities, optional non-cash Journey Tokens, weekly Foundation badge, and cosmetics.
- No login/AuthProvider, AdMob, revenue, withdrawal, RLS, Season1 progression, or current storage changes. Preview lazily opens on demand.
- Local/GitHub source tests and low-cost static typecheck. These are *not* Postgres/Android device verification.

## Strict resource and production restrictions
1. NO new Supabase project or Supabase branch (may cost money); NO migration on the live BUKLOD Main / BUKLOD Connect database; NO migration to the BUKLOD Quiz project; NO service-role keys on client.
2. NO EAS native build, Play Store action, paid testing, billing-plan upgrade, Supabase spend-cap disable, or provider purchase. Only the existing **staging-user Android EAS Update** mechanism is eligible, after free-plan/zero-charge status is established. Do not trigger publishing if billing or quota could incur charges.
3. Production update, release branch, live wallet, cash/QMP, claims, rank and Season1 records must remain untouched. All Season2 rollout flags must stay OFF.
4. A GitHub source CI pass, Expo Android bundle export or user visual review **cannot** authorize a server grant.
5. December 6 is a target and the *earliest* permitted production-review date, not automatic activation. Claim service remains blocked if independent staging backend, signed S1 closeout, cost-free hosting, faith/nonfaith parity, anti-farm, RLS, replay, offline, AdMob and navigation release gates are absent.

## Launchability matrix
| Area | Prepared without spend | Not claimable as complete |
| --- | --- | --- |
| 1300 catalog/item guide, prerequisite and benefit explanation | Yes (source-only) | Real server progress, pending/claimable states |
| Legacy item ownership UI | Source correction | Device rendering and server correctness |
| S2 mastery SQL certification | Draft, RLS/replay guards, untouched live DB | Applied isolated schema, full two-device SQL tests |
| Journey Tokens and Foundation Badge | Source contract + read-only member instructions | Token wallet, credits, purchases and live badge claims |
| Offline/weak network | Existing pure contract/outbox blueprint | Durable persistence plus real server reconciliation |
| OTA | Reuse current Android staging workflow / package and runtime | Charge-free EAS allowance and readback of exact served OTA not yet confirmed |
| Dec 6 production | Disabled plan, recovery and security boundaries | Mandatory owner-specific RC, staging and live verification |

## Test before any FREE staging OTA
- Exact SHA matches the consolidated staging candidate.
- `node --experimental-strip-types --test tests/season2-character-item-ownership-20261119.test.mjs tests/season2-collectible-mastery-guide-20261119.test.mjs tests/season2-zero-budget-item-preview-20261119.test.mjs`.
- `npx tsc --noEmit` and inherited rank/Character/Ads/nav/Season2 financial-isolation tests.
- Expo Free plan or no-charge available allocation **positively confirmed**, no new build requested.
- EAS update `staging-user` channel, `org.mzbministry.buklod.staging`, runtime `1.3.2`, production manifest unchanged before/after; otherwise hold.
- Do not call a preview server-ready, device-verified or production-ready.

## Final missing dependency
A safe separate BUKLOD Main staging backend is currently not connected. The existing BUKLOD Main source must not be used as the isolated certification sandbox; future grant activation requires verified backend isolation and no-cost resources or explicit separate authorization.
