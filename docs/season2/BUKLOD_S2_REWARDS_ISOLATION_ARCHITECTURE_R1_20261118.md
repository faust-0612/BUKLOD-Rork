# BUKLOD Season 2 — Isolated Rewards / Priority / Grace Architecture R1
Date: 2026-11-18 | OWNER: Season 2 only | DEV branch, NO release authorization

## Executive implementation boundary
This work is built on the **verified Season 2 Android staging visual preview**
source af95563fab1d053c82963df65da5f6d55348d811, which itself was
forked from verified Train A production SHA 404c87e55c62a88c95c7389ac8665f237149702a.
The latter has production EAS Android update
01a1ee79-b1f1-7295-9d48-0238ffe0202a, runtime 1.3.2.
Physical AdMob/tab-device behavior was waived; never imply a hardware pass.
Season 2 visual staging EAS update 01a1eef0-50d1-7f01-9619-ee774d78b9ac
remains a separate preview, NOT a reward or production deployment.

**Owner non-negotiable:** absolutely no Season 1 production architecture, rules,
BP/QMP/AdMob, cash, claims, ranks, character levels, inventories, or triggers
may be changed without separate explicit approval. The new server design
is only a dormant SOURCE FILE under docs/season2/sql (not a Supabase migration)
and was NOT applied to any Supabase database.

The active source of truth for existing user money/financial weights remains
existing BP ledger, monthly QMP provider/settlement, and current Character V3.
Kingdom Shards stay game-only. No Focus apps, IGPAT or retired BUKLOD Quiz
are included.

## What was READ, not changed
Read-only live Supabase introspection on 2026-11-18 confirmed:
- public.buklod_rank_seasons: Season 1 exists as active, 2026-08-01..2026-10-31,
  requiring final reconciliation before Season 2 activation.
- public.community_posts has user_id, scope_id, body, media path, hide/delete,
  author_only, category and created_at.
- public.comments has owner, post_id, body, hide/delete and created_at.
- public.buklod_community_dugtongs has author, root id, moderation_state and
  deleted_at; observed moderation state 'approved'.
- public.kl_reading_sessions completed_at and public.kl_quiz_attempts verified_at.
- Existing private.buklod_character_progress_v3 stores independent
  (user_id,character_id) progression; public.buklod_character_collectible_state
  stores discovered/redeemed items, separate from catalog artwork.
- public.buklod_scope_memberships uses ACTIVE / PENDING / LEFT etc.
- Existing authoritative `public.buklod_is_official_system_admin(uuid)`
  is verified callable by service_role; new S2 source, purchase, weekly claim
  and flex procedures reject the protected Official before any wallet mutation.
  Synthetic local PostgreSQL tests use only a made-up Official account.
- public.buklod_should_show_faith_content is an auth.uid-based existing UI
  authorization function. For actual Show Faith checks its precedence includes
  CHURCH scope, CLUSTER admin, ORGANIZATION faith_content_mandatory metadata,
  then per-user preference. An internal service-only Season2 validator MUST
  not call this with a null auth.uid and mistake false for nonfaith. It must
  verify actual user, scope, membership and event-time policy independently.
No live private records were modified or exported.

## System ownership and invariants
| Authority | Season2 treatment | NOT permitted |
| --- | --- | --- |
| Season1 BP/Circle Rank | Read only, untouched | Re-score/debit/alter rules |
| Monthly QMP/30% AdMob | Separate existing monetary weight | Convert tokens, badges or prayer into QMP |
| Per-character XP/levels | Preserve V3; integrate later using verified adapters | Reset on character switch, client grants |
| Items / 1,300 collectibles | Server-owned canonical existing claims | Grant from artwork existence, sell earned level-gated items |
| Kingdom Shards | Continue independently game-only | Exchange with Journey Tokens |
| S2 Journey Tokens | Future noncash, nontransferable, optional | Pesos, withdrawal, transfer, gambling |
| S2 badges | Nonspendable actual server achievement receipts | Buy badges, infer prayer sincerity |
| S2 Momentum | Optional seasonal score only | Delete accounts or subtract BP/QMP/cash |

No S2 token gate is permitted on posting, comments, Connect/chat, safety,
reports, attendance, essential educational content, prayer, Bible access or
accessibility. Optional profile frames, character effects, gallery themes,
emotes, entertainment bonus challenges and cosmetic scene skins may be gated
once staged and approved. All have accessible free default baselines.

## Source → evidence → reward matrix (DEV truth)
The following amounts are OWNER-FACING PROPOSALS, not live grants.

| Eligible source | Show Faith? | Server evidence | S2 tokens | Daily cap | Status |
| --- | --- | --- | ---: | ---: | --- |
| Today/Dugtong | Both | Author-owned accepted approved Dugtong | 2 | 1 | Candidate SQL verifier, NOT deployed |
| KL verified chapter | Both | Completed reading session plus verified KL quiz | 3 | 1 | Candidate SQL verifier, NOT deployed |
| Original Wall post | Both | Real visible author-owned substantive post | 2 | 1 | Candidate SQL verifier, NOT deployed |
| Meaningful reply | Both | Visible >=20-char comment, distinct non-self thread | 1 | 2 | Candidate SQL verifier, NOT deployed |
| Formation | Show Faith | Published, completed, server rubric | 0 | 1 | Existing Main source requires adapter audit |
| Main Bible quiz | Show Faith | Main daily verified graded attempt | 0 | 1 | Source exists; token mint disabled until parity |
| General learning | Non-Show Faith | Real equivalent Main lesson completion | 0 | 1 | Source availability UNVERIFIED |
| Community challenge | Non-Show Faith | Moderated anti-farm completion | 0 | 1 | Source availability UNVERIFIED |
| Kingdom mastery | Both | Server mastery, not local practice | 0 | 1 | Awaiting verified ownership adapter |
| Children's stories | Eligible guardian/opt-in | Age-appropriate private milestone | 0 | 1 | Privacy review required; no child cash |
| Prayer/reflection | Show Faith/opt-in | Private voluntary milestone only | 0 | 1 | No sincerity score, no spendable tokens |

For the first four shared actions, modeled daily earning potential is 9 S2
Journey Tokens, identically available to both scope types subject to actual
feature availability. Daily ceiling 12 is reserved, NOT permission to invent
an extra source or fake unearned 3 tokens. The prior hypothetical 16-token
faith/nonfaith examples are not proof that real parity exists. Faith-only token
awards stay ZERO until genuinely available non-faith counterparts have been
server-verified and parity tested.

Rates are configured in pure TS source and a dormant SQL candidate; no
production switch is turned on. All future qualified sources must be
validated by actual server records, moderation, user ownership, right scope,
duplicate uniqueness, source window, and rolling anti-farm caps.

## P0/P1/P2 priority (only new S2 optional rewards affected)
P0 Foundation weekly requirements:
  1 verified meaningful learning source AND 1 different verified social
  contribution source. Available alternatives must exist in both scopes.
P1 Growth: Character, Kingdom, creative, educational and social milestones.
P2 optional celebration/cosmetic bonus challenges.
Daily Journey Token ceiling reached? A verified P0 learning/social receipt
still counts for Foundation (without minting another token). No Foundation
completion? Ordinary posting, lessons, prayer, Connect,
BP, legitimate QMP, cash and free game routes continue working normally.
Only additional Season 2 OPTIONAL mission bonus stays Pending Foundation.
No source is allowed to satisfy both evidence roles; no fake views,
likes, self-replies, client-reported XP or endlessly replayed tasks.

DEV TS already models the P0 decision and returns NORMAL / GRACE / FLEX /
PENDING_SYNC / UNAVAILABLE / COMPLETE / CLOSED, with zero Season1 impact.
Dormant SQL candidate includes a unique weekly foundation claim with
two single-use source receipt IDs and a new S2-specific earned badge.
The actual server award and mobile UI are NOT deployed.

## Busy-member time budget (Season 2 only)
- 7 consecutive calendar days for ordinary weekly completion.
- +3 automatic grace days.
- Two opt-in Flex Credits per season, 7 days each, spendable in one or two
  weeks only before the regular week's end.
- Deadline is computed in Asia/Manila, not guessed from phone clock.
- Verified pending offline submissions and server outages suspend negative
  settlement; no user loses rewards due solely to unconfirmed client sync.
- Unfinished voluntary P0 bonus may expire only after eligible grace/flex;
  it cannot deduct lifetime BP, Character XP, QMP, badges or cash.
- Momentum daily -5 inactivity, -2 reading, -2 creator (max -9) remains
  PREVIEW-ONLY and opt-in; only after certified closed day and available
  task; do not apply in this stage. Excused, inaccessible, unassigned,
  child, prayer, network and pending requests never cause deductions.
- Zero Momentum NEVER deletes/locks account or erases owned items.

The backend candidate supports a server-owned two-credit flex allocation
and weekly claim with the grace calculation; it does NOT yet include a
production-ready offline/outage attestation store or Momentum settlement
engine. Those are hard blockers, not silently functioning features.

## Token / catalog / ownership dataflow
Authenticated Main activity -> existing authoritative source record ->
new Season2 service-only validator -> isolated S2 receipt unique per
(account, source kind, source ID, rule version) ->
per-account wallet lock -> daily/source cap -> append-only token ledger ->
wallet -> nonessential optional cosmetic purchase with nonce -> S2 inventory.

Weekly badge uses two separate attested S2 source receipts, single-use across
weeks, claim after Foundation completion within deadline. Badge is never
purchased. It does not automatically grant the separate existing level-gated
Character collectible; external canonical Character inventory integration is
a future verified phase.

All Season2 state lives under non-exposed buklod_s2 namespace, with RLS enabled,
authenticated/anon denied and service-only internal procedures. Even service
credentials cannot update the rollout control. Existing Season1 is read only
during the S1-finalization eligibility check. No public API or client service
key has been introduced. An explicit audit trail, administrative fraud
reversals and real offline outbox still require integration and testing.

## Offline / weak-signal receipt contract (DEV only)
New pure TS outbox contract src/lib/season2/buklodSeason2OfflineOutboxR1.ts:
- persist original operation UUID and source reference before attempting network;
- one active in-flight operation per signed-in account (never cross flush);
- queue/sending/unknown result are **Pending verification**, never earned;
- retry with the same operation ID under bounded exponential backoff;
- on app restart, interrupted sending is recoverable with same ID;
- after max retries, keep a Manual Reconciliation record, never silently lose it;
- server reply account/source mismatch quarantines without optimistic tokens;
- only remove a confirmed row after server receipt is durably reflected in
  canonical wallet/history. Source replay is deduped again by Postgres.
This currently has NO AsyncStorage/SQLite persistence, network call, event
hooks, background task, or installed Android behavior. Those require Phase C
staging integration and device tests.

## Wallet test scenarios before any real staging DB migration
1. Deny all direct anon/authenticated SELECT, INSERT, UPDATE, DELETE and EXECUTE.
2. Reject user A requesting B's source, private-scope nonmember, former member.
3. Reject unverified KL, missing reading completion, hidden/deleted post,
   self-comment, duplicate post, duplicate comment in same thread/day.
4. Two devices submit same source concurrently -> one receipt and one credit.
5. Global Manila calendar day and source caps; late offline replay cannot mint
   twice; simulate airplane mode, kill, reboot and retry.
6. Purchase same nonce twice -> exactly one debit/item; insufficient funds,
   stale catalog, concurrent debit and self-ownership.
7. Foundation two-source claim, grace day 3, flex 7+7, source never reused,
   no fake badge, no unearned token or badge after deadline.
8. Faith/nonfaith same real earning opportunity and accessible alternate
   paths; prayer never monetized, child privacy preserved.
9. Character switching maintains each prior level, inventory permanent, and
   only valid character can equip an item.
10. Existing BP/QMP/finance and first-view AdMob, near-instant navigation
    must pass unaffected; Android weak-network test on actual stage binary.
11. S1 unresolved or missing signed Season1 result blocks S2 server enable;
    production before Dec 6 remains embargoed even with flags false.
12. Production release source SHA, runtime, served update ID, package and
    device ad evidence are independent final acceptance gates.

Static source tests cover only source shape and the pure TS decision cases.
They DO NOT replace Postgres, authenticated-user SQL, device or staging tests.

## Execution/rollout sequence; no skipped gates
Phase A [DEV PARTIAL]: exact audited baseline, disabled TS policy and behavior
test suite, isolated server schema/verification + purchase/weekly claim SQL
candidate, source contract guards. All source-only.
Equipment implementation extension: a new isolated `buklod_s2.equipped_cosmetics`
per-character loadout table and service-only equip RPC reference the existing
active canonical Character, without writing to its XP, ownership or per-
character progression. Synthetic PostgreSQL validation must prove cosmetic
ownership, character switching persistence, unequip and access denial. This
is **not** a live Character item bridge or the 1,300 earned collectible store.

Phase B [OPEN]: apply candidate ONLY to an isolated staging Supabase database
after drift/security review (a branch project may cost money), run SQL/RLS,
parallel-source and wallet concurrency/integrity tests. Do not use live prod.
Phase C [OPEN]: stage verified server adapters for all required features,
QMP parity, Character inventory, per-character XP, badge/title UI and
durable offline outbox; replay tests and server security.
Phase D [OPEN]: build full compact Journey/Character/Kingdom UI with reward
preview / Pending / Claimable / Owned / Equipped / Locked explanations.
Run device QA, analytics/audit/anti-farm, no mandatory view/ads.
Phase E [OPEN]: reconcile signed Season1 results and pending credit records,
final owner-approved Season2 economics, season dates and eligible scope parity.
Phase F [OPEN]: isolated staging RC, native runtime, AdMob first-view/fill,
instant tab speed, offline, permission, security and privacy gates.
Phase G [HARD BLOCK]: no production Season2 package before 2026-12-06 00:00
Asia/Manila, and after then only with explicit signed approval, exact SHA,
production embargo guard pass and full acceptance evidence.

## Verified vs pending
- Verified: production Train A source and EAS receipt; native Season2 visual
  staging receipt; GitHub source write to DEV isolated branch. Backend S1 table
  and source column introspection was read-only.
- Written but **not executed on Postgres**: isolated S2 SQL DRAFT.
- Source tests: GitHub Engineering Accountability objective-scope gate passed
  after first test-assertion correction, and disposable PostgreSQL functional
  CI run #44331742746 passed. The latest expanded concurrent-token and
  badge-null-audit tests are verified only when their exact subsequent run
  succeeds; never infer a pass from earlier SHA.
- Not live: token mint/spend, badge claim, weekly Foundation, Flex, Momentum,
  registration, Character inventory linkage, announcements based on grants,
  Season2 full launch.
- No production rules or data were edited, and no new OTA issued here.

## Additional risk gates (local only)
- Official System Admin token/cosmetic grants excluded by the existing public
  protected-identity function (synthetic mocked-in account in local CI).
- A verified source counts toward the weekly P0 badge even when daily token
  ceiling reached. Separate P0 achievement from noncash currency balance.
- Both separate Flex allocation days and duplicate nonces must be checked
  against two-credit maximum, with exact `smallint` RPC arguments.
- Competing independent cosmetic buy nonces against one account must debit
  only once. Local SQL now targets disposable PostgreSQL 17, matching current
  BUKLOD Connect project major version; no Supabase DB write.
