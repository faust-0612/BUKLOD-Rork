# KL R5 — Economy v2 and comments/reactions/replies implementation gate

Owner instruction: 7 BUKLOD Points per first valid chapter completion; 2 BUKLOD Points per qualified comment; reaction button and threaded reply; apply existing BUKLOD economy. Policy module: `src/lib/kabihasnang-ligaw/economyPolicy.ts`. **Policy file alone does not award points or implement buttons.**

## Existing economy invariants
Use the one canonical BUKLOD Points ledger; server authoritative, versioned, transactional, auditable and idempotent. Lifetime and Available balances are distinct. Redemption reduces Available only. Existing Circle Rank and Character levels/history remain intact. Story Journey is cosmetic. Bayanihan has its own ledger and no automatic conversion or peso rate.

## Backend acceptance gates
- Replace legacy +2 KL completion with **+7 prospectively** at controlled policy activation; do not retroactively rewrite prior grants. Once per user per approved released chapter with actual server-validated reading completion, unique key `(account_id, chapter_id, policy_reward_type)`; panimula has no chapter completion award.
- Preserve **+10** once for completed 30-chapter season, transactional unique key. Never double-pay for replay, duplicate taps, concurrent requests, multiple devices, or backfills.
- **+2** per *server-qualified* meaningful top-level comment on an approved released chapter. Must implement explicit server caps per chapter/account and per day, near-duplicate/copy/emoji-only/self-interaction/rapid-fire filtering, and ledger idempotency keyed by immutable comment ID. If caps are not yet configured, **fail closed on earning**, not on ability to comment.
- Reactions: one active reaction per account per comment/chapter target, toggle/switch with upsert, never points by default. Replies: threaded, author-linked, editable/deletable by owner/moderator under RLS, not points by default pending explicit reward caps. Prevent self-reaction earning and coordinated farms.
- Authorization: approved/released chapters only for ordinary readers; authenticated members; block SQL injection, arbitrary ledger mutation, comment impersonation, reaction spoofing. Moderate abuse and expose reporting.
- Reader: provide chapter-end verified completion action with progress feedback and server-confirmed +7 receipt, visible comment composer with sending/sent/failed states, comment list with reaction count/button, threaded Reply action and moderation states. Avoid duplicate submissions, preserve success after navigation refresh failure, cache reading on weak network. **No fabricated success while offline.**
- Admin: pending drafts Panimula/Ch1 remain eligible for human approval; moderation queue and economy audit view. No direct client-admin override of ledger.

## Required cloud-only verification
TypeScript, tests for eligibility/duplicates/caps/concurrent completions, RLS negative tests, cross-account access, existing economy regression, weak-network and Android low-end. V28 baseline reconciliation and frozen RC required. No production database migration or OTA until authorization and passing gates. No local PC writes.
