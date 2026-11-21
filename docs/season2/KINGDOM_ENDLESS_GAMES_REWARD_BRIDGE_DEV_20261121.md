# Genesis Kingdom mini-games + endless progression + unified economy bridge (DEV HOLD)

**Scope:** one BUKLOD MAIN app, 13 Character stations / 39 Kingdom games, separate in-app Empire Arena. Source-only DEV branch atop canonical November 21 world map + Kingdom + Arena integration. Production package, main branch, EAS channel, live Supabase schema/balances, Diamond and financial payouts are unchanged.

## What this patch really delivers
- One reviewed biome artwork and local-premium-music parent per existing Character, inherited by its two pilot mini-games. The native Skia/Reanimated cinematic scene, moving character, feedback events and render-friendly boards remain intact. Source reuse is deliberate, not 39 expensive remote video streams.
- Offline practice encounters are no longer exclusively numbers/word blocks: each level has a compass navigation puzzle with multi-turn route, a repeating nature-signal sequence, and a resource-calculation challenge with visual chips. Deterministic seed per account/game/level, no generated API or subscription.
- Local practice progression no longer stops at 5000. The JavaScript safe integer guard is only an overflow ceiling. Local chapter scenes cycle among five environments for reuse, without fake wallet rewards.
- Four construction tracks (Lot, House, Cluster, Business): levels 1-10, five verified scenes per level, followed by potentially unbounded *server-confirmed* Mastery. The pure projection refuses unverified client counters; preview work-unit curve is NOT a BP charge or binding inventory quote. Actual authored graphics for each world stage and transactional server events remain required.
- Fixed cross-game music ownership: all 39 mini-game backgrounds yield on audio-focus requests from ads, calls and video. Preexisting local CC0 SFX/music and sound preferences retained.

## Canonical reward separation
| Source/event | True authority/ledger | Forbidden inference |
|---|---|---|
| Kingdom game preview or noncredit offline practice | account-local progress only | cannot mint BP, Diamonds, QMP, cash, shards, inventory or Character progression |
| Verified participation | canonical BUKLOD reward event → available earned BP & lifetime-earned BP exactly once | client scores never grant it; anti-farm and source-rule activation required |
| BP market, trade or player transfer | conserved *available BP* debit/credit in authoritative transaction | lifetime BP, Circle Rank and total earned BP unchanged; business mints nothing |
| Construction purchase/build | server-quoted available BP + item/material receipts | no rank gating; no fabricated BP prices or client-only stages |
| Character evolution | separate Character state from BP eligibility + all obtainable verified items | rank not a replacement for items; Show Faith OFF requires equal valid route |
| Kingdom shards | game-only shard ledger | no exchange with BP/QMP/Character Diamonds |
| Empire ranked settlement | server-owned noncash Character Diamonds and effective combat level | no direct client settlement, BP changes or QMP claims; ranked remains disabled |
| Arena Flux | match-ephemeral ability resource, resets per match | never persistent currency |
| QMP/monthly member share | finance-controlled monthly ledgers & provider reconciliation | not equal to BP, game level or guaranteed cash |
| Cash payout | verified legal identity and actual finance release state | no local game/click result can release payout |

**Mandatory server-side implementation still pending:** append-only event receipts, versioned eligibility and caps, per-user/scope RLS, concurrency-safe immutable earning idempotency, two-sided BP transfer with total conservation, verified items/material reservation, cross-account trade audits, Show Faith parity, transactional world stage receipts, rewarded-ad anti-farm restrictions, server-only ranked match escrow/settlement and current Supabase/Finance compatibility. The classification helper is a review policy, not an authorization mechanism.

**Release gates:** Node behavioral test across all 39 games and 5,000+ levels; TypeScript/Metro; art/audio licensing; authenticated UI navigation, first-view Ads and audio-focus; physical device optional only on owner's explicit waiver (unverified); isolated PostgreSQL RLS/concurrent tests before any real wallet/progression rollout; no production Season 2 changes.
