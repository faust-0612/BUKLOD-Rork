# BUKLOD Season 2 — Separate Show Faith / Non-Show Faith Reward Systems

**Decision: owner-requested November 20, 2026. Status: DEV source only, not Season 2 active.**  
Target opening from owner contract: December 6 at the earliest, after verified season closure, backend scope proof, security/RLS, RC and exact-SHA release approval. This is a refinement within approved ten Season 2 feature groups, **not a new eleventh exclusive**.

## 1. Correct separation: two independent reward tracks

| Domain | Show Faith | Non-Show Faith | Financial effect |
| --- | --- | --- | --- |
| Earning context | Existing authorized scope whose resolved show_faith_content=true | Existing authorized scope whose resolved show_faith_content=false | Does not affect BP/QMP wallet ownership |
| P0 weekly learning | Verified qualified Bible/faith formation, or shared KL | Verified general/skills education, or shared KL | 1 distinct learning event each |
| P0 weekly community | Verified faith/community contribution | Verified secular community/support contribution | 1 distinct social event separate from learning |
| Weekly reward mission | `s2_faith_weekly_foundation` | `s2_nonfaith_weekly_foundation` | Optional S2 only; no penalty to ordinary core rewards |
| Track badges | Faith Learning Mark; Faithful Encourager; Faith Foundation Crest | Knowledge Builder Mark; Community Impact Mark; Community Foundation Crest | Cosmetic recognition names **preview only**; no BP/Token/cash |
| Four seasonal awards | Existing four official awards with future faith-scoped evidence/visual variants | Same four official awards with future general-community-scoped evidence/visual variants | No doubling the number of official awards or automatic claims |
| Member identity | Never infer or store religion from use; this is a CONTENT/SCOPE reward classification | Same | Do not require spiritual disclosure |
| Shared achievements | Canonical Circle Rank, Character 13×20×5 items, 469 catalog badges, Kingdom and QMP preserved | Same | Same persistent ledgers, no conversion |
| Core ordinary BP | Existing Season 1 catalog; faith-specific activities may remain configured while trigger is independently validated | Neutral already configured activities; equivalent educational source rates below are **proposals only** | No Season 1 rules changed |
| QMP | Same original event qualification and monthly funding logic; track reporting as metadata | Same | No split, multiply, or mode-based adjustment to 30% eligible pool |

**No two canonical lifetime BP wallets or two financial/QMP ledgers**: the split is SOURCE ELIGIBILITY, mission progress, private seasonal badge/award eligibility, and audit history. This prevents two wallet balances for one individual and preserves every Season 1 earning. Shared event records cannot be claimed twice by toggling mode or navigating through two scopes.

## 2. Specific learning BP — separate but fair opportunity

These are planned equivalences to make the future Non-Show Faith learning program comparable. The nonfaith amounts are **NOT active catalog rules** and grant **0** until a real published general lesson/quiz and server verifier are independently available.

| Show Faith source | Catalog BP | Non-Show Faith equivalent target | Proposed BP |
| --- | ---: | --- | ---: |
| Verified Daily Bible | 10 | Verified General Daily Reading | 10 |
| Devotional | 12 | Genuine Personal Learning Reflection | 12 |
| Bible Quiz Easy | 3 | General Knowledge Quiz Easy | 3 |
| Bible Quiz Medium | 6 | General Knowledge Quiz Medium | 6 |
| Bible Quiz Hard | 12 | General Knowledge Quiz Hard | 12 |
| Formation Lesson | 25 | Life / Practical Skills Lesson | 25 |

The user may still participate in common neutral sources (Wall, KL, community posts, approved events, volunteering, mentoring, qualified game milestones). A future S2 bonus requiring **Bible, prayer, devotional, church identity or faith disclosure** is never a prerequisite for Non-Show Faith. Faith-specific existing catalog entries remain labeled and historically preserved; new nonfaith values do not overwrite existing BP rates.

## 3. Both-mode Journey Tokens and limits (future, not live)

| Server-verified source | Show Faith | Non-Show Faith | Daily count |
| --- | ---: | ---: | ---: |
| Today / Dugtong | +2 | +2 | 1 |
| Completed & verified Kabihasnang Ligaw chapter | +3 | +3 | 1 |
| Qualified original Wall post | +2 | +2 | 1 |
| Meaningful Wall comment | +1 | +1 | 2 |
| Faith Formation / Main Bible Quiz | **0** | N/A | Blocked until fair verified nonfaith learning adapter |
| Nonfaith General Learning / Community Challenge | N/A | **0** | Blocked until real server verifiers |
| Kingdom mastery | 0 | 0 | Unimplemented isolated adapter |
| Children story / private prayer | 0 | 0 | Never cash, prayer never spendable reward |

Configured earning maximum is 9/day, global user/token cap 12/day; **not 9+9 or 12+12** when switching scope. In one month QMP creator bonuses and missions remain original verified qualified accounting; no religious/faithness multiplier.

## 4. Weekly rules and historical progression

- **Separate weekly mission namespace by track**, identity must be computed from authorized scope + user + source event time on the SERVER. Client-rendered scope is informational only.
- P0 in either mode: 1 independent verified learning receipt + 1 independently verified authentic social contribution. 7 days ordinary completion, +3 days grace, 2 opt-in Flex Credits ×7 days per season; no forced full-time activity or private spiritual disclosure.
- Badge preview and potential mode-specific seasonal recognition do not grant actual badges until canonical server evidence and owner economic approval. Existing 469 character badge catalog, 40 rank visuals and 1,300 items remain shared Character authority; no retroactive relock.
- One source receipt can be consumed for one optional weekly mission globally across two tracks (unique source identity includes user/source type/source id, *not* mode); even a member with multiple authorized scopes cannot farm extra weekly bonus by switching.
- Changing the active scope after submission must NOT retroactively change the mode recorded for a previously earned event. Inactive, deleted, suspended, unverified, unauthorized or stale events fail closed.
- Only future optional seasonal competition/missions can reset. Lifetime BP, Circle Rank, per-character XP, owned items, permanent badges, QMP financial history, finalized cash and past activity remain immutable apart from independently audited fraud reversal.
- Optional Momentum remains OFF; no deductions to BP, QMP, actual money, owned items or ranks, no penalty for missing optional prayer or Bible.

## 5. Why user-selected mode must NOT grant rewards

Current BUKLOD UI exposes `activeScope.show_faith_content`, derived from a combination of personal preference and scope policy. Read-only database inspection found a complex existing precedence in `buklod_should_show_faith_content(_scope_id)`: CHURCH enforced, certain CLUSTER admin contexts, faith-mandatory ORGANIZATION, else the user's Show Faith preference. That existing RPC relies on `auth.uid()` and cannot safely be called by a service-role backend with no end-user JWT to determine past event-time mode.

**Mandatory server integration gate** before rewards:
1. Verify the real author/member, source entity and original server-created timestamp, not input claims.
2. Reconcile exact original scope and membership validity at the original event time, not a recent screen route.
3. Prove effective Show Faith/Non-Show Faith state using a versioned authenticated event-time policy attestation; fail closed if historical preference and scope role cannot be reconstructed.
4. Tag scope-local source as show_faith/non_show_faith and a genuinely unscoped shared source as shared without inventing a source scope. Prevent claim into either path without a separately verified membership and unique consumption proof.
5. Enforce unique `(user_id,source_kind,source_id)` in the original S2 source ledger across mode switches, and global `(user_id,week_start)` optional weekly payout cap.
6. Prevent cross-account, cross-scope, reopened/deleted/moderated source, stale offline device, duplicate retry, mismatched event-time faith scope and misused service API claims.
7. Use a non-exposed, explicit permission/RLS protected staging schema and no service_role key in a mobile client. Test anon/auth service grants and concurrent calls in the REAL isolated staging Postgres.

The SQL extension is **only a fail-closed candidate**: `docs/season2/sql/BUKLOD_S2_FAITH_NONFAITH_TRACKS_DRAFT_NOT_DEPLOY.sql`. Its enabled/proof/settlement flags cannot be true. It creates no mint/spend RPC. Production and the currently connected BUKLOD MAIN backend remain untouched.

## 6. User guide and source tests

- `src/lib/season2/buklodSeason2RewardTracksR1.ts`: explicit track, 11 source kinds, 6 future BP equivalences per track, four shared Token sources, unique original source, scope mode and evidence previews.
- `src/components/points/BuklodS2RewardTracksGuide.tsx`: active scope-derived path, separate per-track lessons and badges, optional explanatory comparison, complete and clear disabled status.
- `src/components/points/BuklodS2CompleteRewardsReference.tsx`: makes "2 REWARD TRACKS" first tab; full BP/QMP/Tokens/1,300 items/469 badges/40 rank catalogs remain available in their own tabs.
- `tests/season2-showfaith-nonfaith-reward-tracks-20261120.test.mjs`: adversarial source mode, stale authority, lack of membership, anti-replay, parity, no monetary grants, paused SQL and UI context.
- `tests/season2-complete-reward-encyclopedia-20261120.test.cjs`: ensures the full reward encyclopedia remains accessible when two-track guide is first.
- Required later: deployed isolated server attribution, source-specific mode proof, membership/history validators, actual mission/badge/Token settlement adapters, end-to-end RLS and Android staging verification; only then a signed owner-approved release.

**Current result: isolated DEV rules + read-only UI.** Not activated; December 6 target is not automatic permission to grant. The 10 approved exclusive groups and live Season 1 are unchanged.
