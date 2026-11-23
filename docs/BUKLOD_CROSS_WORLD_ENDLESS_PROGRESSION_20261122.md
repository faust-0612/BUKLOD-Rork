# BUKLOD MAIN Genesis — Kingdom / Empire Arena / My House integration

**Scope:** isolated DEV design contract, no backend migration, no signed staging / OTA / production change.

## The three worlds have independent authorities

| World | Progression | Source of truth | Cross-world connection |
|---|---|---|---|
| Character Kingdom | Kingdom XP, noncash Kingdom Score, Mastery 1–∞, procedurally difficult challenges | Future VERIFIED Kingdom challenge and mastery event RPC; Character System remains authority for per-character achievements and inventory | Verified milestones can propose House decorative blueprints and Arena lobby cosmetics |
| My House / Lot | Levels 1–10, five visible construction stages per level, then independent endless Mastery | Existing estate \`constructionPlan.mjs\`, \`get_buklod_estate_snapshot_v1\` and server-owned construction RPCs | Verified construction can unlock Kingdom decorative motifs and Arena lobby visuals |
| Empire Arena | Server-owned win/loss, Diamond escrow, ranked rating and seasonal brackets | Authoritative Arena coordinator and match-settlement RPCs | Verified ranked achievements can unlock decorative trophies for Kingdom and House |

**No duplication:** the existing server-scored Kingdom Mastery Check gives **+2 BP only on the first qualified 3/3 completion per account/game** through the existing points ledger. New Mastery level-ups, travel, practice loot, ordinary construction, trading or client-only events **never** grant BP or lifetime BP. QMP, Diamonds, BP, Shards, Character items and Arena ratings stay on their own existing authorities. Solo, cooperative and non-combat development paths remain valid without forced Arena entry.

## Proposed Kingdom Mastery balance

\`requiredXp(M)=round(400+50M+100*sqrt(M))\`

\`challengeXp(M)=round(50+3M+20*sqrt(M))\`

\`kingdomScore(M)=round(100+60*log2(M+1))\`

| Mastery | Required XP | Qualified challenge XP | Score per tier |
|---|---:|---:|---:|
| 1 | 550 | 73 | 160 |
| 10 | 1,216 | 143 | 308 |
| 100 | 6,400 | 550 | 499 |
| 1,000 | 53,562 | 3,682 | 698 |

These are **non-credit estimates**, not actual issued rewards. Gameplay difficulty should scale with skill, coordination, environment and rotating mechanics, not just enemy HP, arbitrary waiting or grinding. For extreme numeric levels, the frontend refuses imprecise XP quotes. House construction costs are independent and continue to be determined by the existing verified estate RPC.

## Proposed links (NOT yet owned or usable)

- Kingdom Mastery 25: House artisan pergola blueprint; Arena verdant lobby banner
- Kingdom Mastery 100: House fountain blueprint; Arena veteran emblem
- House Mastery 10: Kingdom homestead village arch; Arena homecoming lobby banner
- First verified ranked Arena win: Kingdom honor stand; House first-win trophy shelf

These cosmetic names are unissued design IDs, not real inventory entries, rank rewards or purchasable items. **Ranked Arena outside-world stat/power bonus = 0.** Practice match pickups never convert to tradable assets. My House can progress without playing Arena.

## Server integration and release gates

1. Add an approved, versioned cosmetic catalog and auditable verified-event definitions; preserve Character System as item entitlement authority. Each receipt must originate in an actual authenticated backend record, never a phone-submitted score.
2. A DB transaction should check actor, account/scope, eligibility, version, canonical completion source, exact cosmetic ID and \`UNIQUE(user_id, verified_event_id, cosmetic_id)\`. Races/retries must be idempotent.
3. Provide read-only server-verified owned-cosmetic snapshots to each world. Offline visual cache must not be a spendable wallet. Never change existing BP, QMP, Diamond, Shards, estate wallets or Circle Rank via this contract.
4. Test duplicate completion, replay, multiple devices, stale account, self-trade, cross-account RLS, Arena disconnect/settlement, consent/first-view ads, instant navigation and new native pack compatibility.
5. Keep all new receipts disabled until backend SQL, RLS, full regression and isolated Android signed RC gates pass. Preserve production 1.x and separate staging Genesis 2.x.

**Verified in DEV:** five pure Node rule tests covering representative high Mastery values, points isolation, cross-world whitelist and invalid-input cases. **Not verified:** native Android runtime, actual owned cross-world inventory, live backend grants, a signed RC/OTA or production. No migration deployed.


## DEV implementation extension — server-verified showcase receipts (November 22)

The first real linkage is **display-only, nontradable cosmetics** in all three
worlds. A private RLS-protected receipt table and two authenticated RPCs are
prepared in \`supabase/migrations/20261122150000_buklod_crossworld_verified_cosmetics_v1.sql\`.
The client does not award items. On explicit user **VERIFY / SYNC** request,
the server counts **distinct game IDs** with first completed **3/3
server-scored** Kingdom checks **AND** the existing matching canonical
\`game_first_qualified\` +2 BP ledger entry. Only those proofs qualify.
Existing BP is never touched and the original +2 BP policy remains unchanged.

| Verified distinct checks | Kingdom visual | House showcase | Arena lobby showcase |
|---|---|---|---|
| 1 | Prospect Lantern | Artisan Planter | Apprentice Banner |
| 10 | Honor Beacon | Heritage Pergola | Kingdom Banner |
| 25 | Masterwork Arch | Kingdom Fountain | Veteran Emblem |

These nine items are **server-confirmed showcase badges**, not yet Godot
scene decorations, craftable inventory, equity, saleable Shards or equipment.
The existing Character System remains authoritative for tradeable equipment,
collectibles and inventory. The safe display-only receipts do not substitute
for a Character item entitlement. All three React Native worlds have the same
collapsed-first achievements panel and one-tap navigation to the other worlds.
The panel fetches only when expanded; it declines malformed replies and stale
account responses. Delayed verification cannot silently overwrite a newer
claim.

**House→Kingdom/Arena and ranked Arena→House/Kingdom grants stay blocked**:
the read-only inspection of the current paid Supabase production schema on
November 22 found neither a live estate construction RPC/table nor a real
ranked Empire Arena match-settlement table. The existing Godot world scenes
are preview-only, and offline Arena results are not proof of actual ranked
wins. Do not auto-activate these reverse flows from a client-submitted win,
local construction blueprint, old IGPAT result, or mutable preview storage.
After verified estate and Arena settlement sources exist in a separate RC,
connect them through backend-owned, idempotent event receipts and only then
enable the corresponding catalog visual entitlements.

### Verification / deployment distinction
- DEV branch source: nine intended touched files plus prior four-file design
  contract; no migration applied to the live database.
- Source evidence: exact backend source-key join, private table RLS and
  restricted grants, one-claim idempotence, no BP/Shard/Diamond writes.
- Focused regression contract tests committed. Existing five local pure
  progression tests were previously run successfully; new contract checks are
  source checks, not isolated PostgreSQL execution or Android QA.
- Base branch independently advanced with APK workflow/release receipts. Those
  changes are disjoint from this feature, but signed native release and
  protected production gates must still be verified before any merge/publish.
- Live production, running Supabase schema, OTA channel, and installed app are
  **UNCHANGED** by this DEV implementation.
