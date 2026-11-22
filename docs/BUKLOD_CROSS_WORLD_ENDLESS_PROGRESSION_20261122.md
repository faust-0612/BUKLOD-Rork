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
