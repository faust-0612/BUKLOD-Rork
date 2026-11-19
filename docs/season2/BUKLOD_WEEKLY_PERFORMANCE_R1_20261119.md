# BUKLOD Season 2 Weekly Performance R1 — staging implementation

**Scope:** User-authorized replacement of **only the small green N** at 2 o’clock on member avatars. The 10 o’clock Circle Rank, changing avatar border, blue online indicator at 6 o’clock, Wall/Connect avatar press behavior, and actual Connect Notes/Note Chip are unchanged. No new drawer item.

## Classes and backend authority

The canonical SQL candidate is at `docs/season2/sql/BUKLOD_S2_WEEKLY_PERFORMANCE_READONLY_STAGING_CANDIDATE.sql`; it is NOT under migrations and MUST NOT be deployed to production.

Philippines timezone week runs **Monday 00:00 to next Monday 00:00**. The SQL computes a distinct, per-day verified participation footprint rather than counting raw reactions/comments/volume:

- **Active days:** max 7 × 5 = 35 points.
- **Learning days:** max 5 × 6 = 30; e.g. claimed verified Bible reading, lessons, quiz; faith participation is strictly optional.
- **Community impact days:** max 5 × 7 = 35; qualifying community support or verified creator impact with still-visible source.
- **Quality contribution days:** max 5 × 6 = 30; moderated quality bonus, verified weekly tip, or 40+ character original, nonhidden, nonduplicate Wall post linked to its claimed event.

Total capped at 100. A category/day counts once regardless of repeated uploads. Claim-state must be `claimed`, direction `credit`, points > 0, and server-originated; `pending`, reactions, basic comments, attempts and local/offline drafts don't count. The SQL implementation uses only the existing read-only Points ledger evidence and no table mutations.

| Class | Minimum score | Days | Categories |
|---|---:|---:|---:|
| Unrated | 0 | 0 | 0 |
| Emerging | 1 | 1 | 1 |
| Active | 25 | 2 | 1 |
| Thrive | 60 | 3 | 2 |
| Exceptional | 85 | 4 | 2 |

Two-category requirement prevents a single repetitive activity category from yielding top classifications. **New members can achieve Exceptional in 5 days using community + creative contributions without any faith-related activity**, if independently verified and claimed. Activities that don't exist in a member's cluster are not compulsory. Member scores reset automatically on a Philippines Monday by time-filtered queries, never by deleting their lifetime BP or Circle Rank. Already-verified late claims require server-period reconciliation.

The badge is retrieved from server `public.buklod_weekly_performance_batch_s2(uuid[])` in batches ≤32, confirmed against *current* Manila week, and not rendered if the backend returns malformed/stale/missing data. The own-Profile panel uses separate no-argument `public.get_my_buklod_weekly_performance_s2()` and is visible only to the authenticated subject. Other members see only an icon/class, never activity category breakdown. Client is additionally gated to **staging package and appEnvironment**, and uses cooldown on missing service to avoid hammering weak connections.

## Weekly recognition rewards — currently HELD

One **highest achieved** reward candidate per `(member_uuid, week_start)`, after closed-week verification, moderation, and a separate Season 2 grant control:

- **Active:** weekly recognition emblem.
- **Thrive:** weekly cosmetic profile frame.
- **Exceptional:** distinctive weekly collectible.
- Emerging/Unrated: no payout, class recognition remains visible.

This is a *non-cash cosmetic preview*, not a live reward. Source code exposes a deterministic idempotency-key intent, but no backend grant endpoint. No BP, QMP, AdMob revenue, withdrawable cash, transfers, tokens, legacy Season 1 ledger or inventory mutation is allowed. A future service-role-only receipt system must be idempotent and grant at most the highest final weekly class; the frontend cannot mint by falsifying a classification or using an offline request.

## Staging dependency and release gates

The isolated SQL is **source candidate**, not a migration. Do NOT run it against the connected active Supabase project unless it has been independently proven to be a dedicated BUKLOD MAIN staging backend. Production Season 1 and all finance remain untouched.

Before enabling badge displays in staging, apply and verify candidate SQL against a verified staging database, test RLS, unauthorized/locked subjects, eventual consistency, bounded 32-avatar batch performance, weak-network retry, and Monday rollover. Then verify Android runtime, actual AdMob fill and dashboard/tab speed; require staging-only release evidence. The production embargo before **2026-12-06 Asia/Manila** and separate approval for actual Season 2 rewards remain in force.

In this branch, if the staging backend functions are absent, the indicator shows **nothing** and the owner's Profile truthfully says it is awaiting verified staging data. It never guesses a performance class.
