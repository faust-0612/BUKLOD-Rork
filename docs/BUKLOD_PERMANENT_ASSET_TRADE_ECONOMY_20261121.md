# BUKLOD permanent participation-to-trade economy — DEV contract
Date: 2026-11-21. Status: isolated DEV/HOLD; no backend migration, OTA, cash/QMP change or release activated.

## Reconciliation to other ongoing work
- Main baseline: 536741f8d97fc9dec91503c89f1c1160e5987ce0. Production OTA fingerprint not independently verified.
- PR #1039 Market/Palengke is the real-world seller/listing/reservation and Public Wall/Connect system. **Do not replace its Market route**. Virtual BP materials use a separate /profile/buklod-bp-market route, accessible from existing Profile -> Focus Apps.
- PR #1042 World has 10-level personal lot/house/farm/Cluster/org **preview** and a BP wallet/provenance draft; use its world scenes once reconciled, not a second world authority. Its QMP policy is unapproved and remains off.
- PR #1041 Character evolution has 13-character server-verifiable, faith-optional item gates. Character-bound evolution receipts and collectibles must **not** automatically be tradable construction stock.
- The existing lifetime Rank relies on buklod_user_points_balances.lifetime_points; weekly/seasonal Rank uses claimed ledger credits. Trading receipts must not masquerade as participation minting.

## Non-negotiable economy invariants
1. Only existing canonical verified participation rewards mint new BP. Trade, registration, listing, material consumption and asset upgrades NEVER mint spendable BP.
2. Currency and Rank are different dimensions: **spendable BP** is transferable and decreases on a purchase; lifetime Rank never decreases on spend. A verified **net profit** may count as Rank-only progress after fraud controls (no second spendable credit).
3. One purchase = one transaction: seller item escrow decreases; buyer inventory increases; buyer BP decreases; seller BP increases by exactly the same amount. Sum of spendable BP across members is conserved before transaction fees (none in V1).
4. A participation item grant is mapped to a single credited, claimed/legacy ledger UUID and cannot be claimed twice. Faith-neutral social activities can supply required materials even with Show Faith off.
5. A listed item is moved into escrow before it is advertised. Listings reserve exact quantities and cost basis; cancel restores unused stock, and sold stock never reappears.
6. Buying materials is an alternative to doing the source activity; valid BP must still be earned through participation. A buyer **does not** have to complete the original supplier's item-specific activity.
7. Suppliers can be producers, resellers or both; source-acquired item cost basis starts at 0 BP, purchased inventory cost basis starts at actual paid BP. Profit is max(0, sales minus allocated cost basis); gross sales themselves do not improve Rank.
8. No paid BP top-ups, fictional BP grants, BP stakes, member cash/QMP rewards from marketplace activity, wagering, or direct client mutation of wallets/inventory.
9. Transaction dedupe keys are buyer-scoped and reject reuse for a different listing or quantity. The UI persists buyer-and-listing-scoped retry keys in AsyncStorage until a confirmed receipt so an app restart after an ambiguous checkout does not issue a second BP payment. Stable row locks serialize inventory, listings and wallets; business construction locks wallet BEFORE inventory to match the buyer checkout lock order. Operations fail atomically and should be retried only with the same key after ambiguous network failure.
10. Shared admin or official accounts cannot farm participation or buy/sell BP stock for themselves. Any Real World sale/permit/payout requires separate product/legal design.

## Registration and business growth
V1 starter conditions: active approved member; 5 distinct canonical verified participation credits; orientation acknowledgment; at least 40 legitimately spendable BP starter capital. Business name and category may be any lawful category. No Circle Rank gate. Only one personal business per member at this initial stage; future multi-store permissions require a separate scope model.

Business level 1 begins as land survey and posts, not a beautiful finished roof. Every level 1–10 includes five distinct visible construction stages:
1. Survey / posts
2. Frame
3. Walls
4. Roof
5. Fixtures / finishing

Recipes escalate approximately 1.65 times per business level, using wood/stone/nails/metal/glass/fabric and a limited BP construction cost. Levels cannot be skipped; a seller must complete the current level's five stages before listing. Purchased materials are valid inputs exactly like earned materials. A business must expand with verifiable inventory and spendable BP, never just a Rank number.

## Item provenance and trade
- Server accepts only a white-listed participation ledger credit belonging to auth.uid with claim_state claimed/legacy and positive real points, mapped to material category on the server. No arbitrary "grant 100 wood" client API.
- Generic wood/stone/nails/fabric/metal/glass are exchangeable **virtual construction materials**; the 1,300 Character story collectibles and separate character evolution item gates are not silently converted to market inventory.
- Listed stock is transferred from available inventory to escrow; stock and allocated cost basis move together.
- The trade RPC locks the listing and both wallet rows, checks buyer/seller activity and available BP, writes a unique order, a canonical debit ledger receipt for the buyer and an isolated **BP transfer receipt** (not a second reward-credit row) for the seller, moves stock to buyer, and updates seller available BP. No cross-user client-table write.
- The BP buyer debit is executed through the existing AFTER INSERT debit ledger trigger; do not also decrement buyer available directly. Every purchase, build or Rank receipt uses a unique source_key per event to honor the live (user_id,source_key) uniqueness constraint. Existing claim_state values are preserved without alteration.
- Seller Rank profit waits 72 hours and checks distinct counterparties, buyer account age and caps: max 200 rank-only BP per order and 500 per seller per rolling week in V1. Above-cap or potentially circular trades remain REVIEW and confer no automatic Rank. Verified net profit is recognized via claim_state claimed, activity market_verified_profit, lifetime_points Rank increment, **without** available_points increment. This design needs runtime regression review of all existing points dashboards and rank badges.
- Note: these initial six material SKUs are a DEV foundation, not the full 72+ World item catalog. Reconcile item IDs/units/recipes with World PR #1042 before a full asset rollout.\n- V1 does not support returns/refunds, shared business ownership, lending, arbitrage bots, direct BP member gifts, or physical cash. Further releases require moderated reversals and source-linked fraud graph checks.

## World/Community integration contract — required before full release
The following is the unified model to reconcile with PR #1042 and existing scopes. It is NOT implemented by the two trade migrations:
- One map authority for personal LOT / HOUSE / FARM, business shop and scope-owned CLUSTER / ORGANIZATION structures. Each has a permanent development level 1–10, five in-level visible construction stages, verified material receipts, and independent rank.
- Two views: **My Lot** (owned structures, foundation/post/frame/walls/roof/interior, purchase and placement tools) and **Community** (all member lot footprints and stage-accurate buildings, plot availability, adjacent lot labels using privacy-safe display names and opt-out rules, neighboring communities).
- A plot allocator must check free adjacent cells and reservations before expansion. If blocked, offer migration of the owned structures to a larger virtual farm lot without destroying history/items; old plot returned to availability. No overlap or phantom land.
- Cluster compound and community lots require member contributions from their **own transferred existing BP** to an audited scope treasury, role-approved procurement, membership quorum and server-side escrow. Only verified authorized Cluster admins may place structures. No member may redirect a community treasury into a personal business.
- Business world placement must reserve verified available space and reflect unfinished construction **in both** personal and shared community scenes; never a completed roof while server stage is posts.
- Community projects/challenges and QMP/real-money payouts remain separate with server-trustable, conflict-free verification and caps.
- Seasonal art/camera/lighting are visual overlays only. Permanent asset ownership, level, inventory and plot coordinates persist.
- Premium rendering, real neighbor geometry, community lot pools, house/farm consumption and Community view require the separate World implementation and staged tests. Do not describe them as live from this DEV PR.

## Deployment gates
1. GitHub DEV scope gate, Node regression, TypeScript and Expo compile.
2. Verify migration against **isolated parent-schema Supabase staging** with real RLS role impersonation, debit-credit transaction conservation, same-key retry, simultaneous buyers, cancelled escrow, credit/reverse pathways, and stale wallet caches.
3. Cross-check exact live R2 and Season 2 rules; ensure no market transfer earns QMP, referral cash, achievements, claim events, ad revenue or double Rank.
4. Reconcile PR #1039 / #1042 / #1041 into verified RC; then test Android client, wallet view reload, first-view AdMob, tab/navigation latency, weak-network retry and unexpected app kill.
5. Keep configuration enabled=false and rank_profit_enabled=false until evidence-backed approval. No DEV-only migration should touch production.
