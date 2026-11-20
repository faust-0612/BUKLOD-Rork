# BUKLOD Permanent Asset & Participation-to-Trade Economy — implementation contract

Status: DEV policy scaffold only. No live marketplace settlement, migrations or release authorization.

## Canonical principles
- Verified participation remains the only existing BP issuance authority. Trades never mint BP; transfers must conserve the sum of spendable BP.
- Legitimately acquired items may be stacked and listed for resale. Participation-earned, traded and crafted items carry provenance; bound/achievement/identity items are not automatically tradable.
- Buyer uses legitimately available BP to acquire items and bypasses the item's original collection activity, **not** construction sequencing, membership, compliance or identity requirements.
- Buyer rank never decreases because of purchases. Seller rank can increase only by separately verified **net economic profit** under an approved rank policy, not gross proceeds. Existing rank formula must be reconciled before activation. Avoid repeated rank credits on resale and wash trades.
- BP available balance, lifetime rank progress, and QMP/revenue are distinct authorities. No marketplace transaction alters QMP.
- Lot, house, cluster and business each have levels 1–10 and five ordered build phases: materials, posts, frame, structure, finish. Permanent construction is season-independent; cosmetics may change.
- Higher levels require increasing effort, materials, footprint and/or verified contributions. No immediate polished structure at level 1.
- Personal lot expansion requires contiguous vacant capacity. If unavailable, offer relocation to a larger lot with an atomic asset move and preserved ownership, or cluster-funded expansion to a bigger compound with contribution and governance records.
- Community map shows under-construction geometry (posts, frame, walls, roof only when earned), owner-approved neighbor labels and scope names. Never expose private home addresses or exact personal coordinates by default.
- Business opens only after approved membership, orientation, verified business identity, usable space, capital, initial stock and applicable compliance. In-app permit is not a government permit. Any lawful permitted category may trade; regulated goods/services need additional policy controls.
- Show Faith OFF must have equivalent non-faith routes for every progression-critical tradable item.

## Backend data model to implement (additive, migration gated)
1. asset_parcels(id,scope_type,owner_id,community_id,grid_geometry,capacity,version), asset_structures(id,parcel_id,kind,level,phase,progress,version), parcel_moves(id,from_id,to_id,actor_id,status).
2. item_definitions(id,category,tradable,bound,acquisition_rules,rarity,season_independent), item_stacks(id,owner_id,item_id,quantity,reserved,version), item_provenance(id,stack_id,source_kind,source_ref,quantity).
3. businesses(id,owner_id,parcel_id,category,verification_state,level,phase), listings(id,business_id,item_id,quantity_available,quantity_reserved,unit_price_bp,status,version), orders(id,buyer_id,listing_id,quantity,total_bp,status,idempotency_key UNIQUE), settlements(id,order_id UNIQUE,buyer_debit_id UNIQUE,seller_credit_id UNIQUE,inventory_transfer_id UNIQUE).
4. asset_requirements(asset_kind,level,phase,item_id,quantity,effort), asset_consumptions(id,structure_id,phase,item_id,quantity,source_ref UNIQUE), community_contributions(id,community_id,member_id,amount_bp,settlement_ref UNIQUE).
5. trading_cost_basis(id,provenance_id,unit_cost_bp), rank_profit_reviews(id,settlement_id UNIQUE,eligible_net_profit_bp,status,review_reason), trade_risk_flags(id,order_id,reason,state).

## Settlement transaction (server-only, fail closed)
1. Authenticate member, verify business and active listing, eligibility, no self-trade or linked-account abuse; check idempotency key and previous result.
2. Lock listing, buyer and seller wallets, item stacks in deterministic order. Verify spendable BP excluding holds, and unreserved stock. Validate integer quantities and prices, limits, and version.
3. In one database transaction: reserve and debit buyer's existing BP, credit exactly the same amount to seller, decrement seller inventory, increment buyer inventory with provenance, write matching immutable ledger entries, order and settlement, and release holds.
4. Commit only when all writes succeed; otherwise roll back all changes. Retry safe serialization conflicts with bounded retries; repeated idempotency key returns original outcome. Never use client-provided balance, profit, rank or inventory as authority.
5. Refund/reversal must atomically reverse the corresponding BP and item movements or open an audited dispute when item has been consumed. No negative balance or silent partial reversal.
6. Reconcile wallet conservation, stock conservation, orphan reservations, duplicate keys and negative balances. Audit suspicious round-trip trades, price outliers, linked accounts, refunds and circular trades. No auto rank credit before final profit verification.

## Ranking & economic fairness
- The BP wallet is spendable; purchases reduce it but **never** reduce cumulative Circle Rank.
- Seller proceeds are not equivalent to profit. Net profit = sale receipts minus verified inventory acquisition cost, applicable platform costs, refunds and losses. For participation-earned inventory, zero BP acquisition cost may apply, but repeated synthetic item farming and related-party sales must not earn rank.
- A qualified-profit rank award is a distinct, one-time verified record with source settlement and an abuse/cap policy. Existing Circle Rank logic must be extended only after a rank compatibility migration and regression tests.
- Non-tradable character collectibles and progression-critical items must be classified explicitly before launch. Do not allow purchased item ownership to rewrite historical participation completion.
- No guaranteed price floors or instant buyback minting. Anti-monopoly rules must preserve multiple accessible item acquisition paths.

## Release gates
DEV policy and tests -> additive database migration and RLS/security-definer RPC review -> wallet/item concurrency, refunds, wash-trade, overflow and fraud tests -> staging end-to-end build and community rendering -> verified RC -> production. Do not publish marketplace payments or rank changes until all gates pass.
