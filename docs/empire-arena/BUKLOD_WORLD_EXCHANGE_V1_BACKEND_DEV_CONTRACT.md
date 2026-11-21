# BUKLOD World Exchange V1 — isolated backend candidate

> **DEV ONLY / DEFAULT DISABLED / NOT A LIVE MIGRATION.** Reconciles owner correction of 2026-11-21 with BUKLOD Empire Arena V2, Kingdom, personal/Cluster construction and the existing BP ledger. The authoritative gameplay design remains [`BUKLOD_EMPIRE_ARENA_V2_CANONICAL_DESIGN.md`](./BUKLOD_EMPIRE_ARENA_V2_CANONICAL_DESIGN.md).

## Owner-locked BP policy (no double counting)

- **BUKLOD Points are earned only once when an independent, verified participation-reward service issues them.** Earned lifetime BP is a historic ledger/rank metric. Spendable BP is an existing balance that may change ownership.
- **BP itself is not a purchasable or saleable item.** Members may purchase verified eligible *goods* (character-exclusive equipment certificates, Kingdom items, community construction materials or approved strategy items) *using existing spendable BP* from other members of any Cluster.
- **No additional lifetime BP / Circle Rank / character earned BP / QMP arises from a transfer, sale, resale, refund, item donation, or item custody change.** Neither buyer nor seller gets a second earned-points credit. Economic value can still help a specialist advance in a different feature via purchased eligible materials, but it never bypasses level/rank/item gates.
- **Transaction invariant:** `buyer.available -= price`, `seller.available += price`, both `lifetime_points` unchanged. `sum(available before) == sum(available after)` excluding separately authorized participation-reward issuance. The marketplace does **not** insert into `public.buklod_points_ledger` because current live ledger credit/debit triggers affect accounting and rank history.
- Example: buyer earned lifetime 500 BP, has 120 spendable BP; seller earned lifetime 300 BP, has 25 spendable BP. They trade an eligible Quin Compass certificate for 40 BP. Buyer spendable 80, seller spendable 65; buyer lifetime remains 500, seller lifetime remains 300; both rank orders unchanged. This is a **transfer**, not a second earning event.

## Verified authoritative read-only baseline (2026-11-21)

- Live BUKLOD MAIN project `yhanxndaqbmuzbdqlblu` has `public.buklod_user_points_balances(user_id,lifetime_points,available_points)` and `public.buklod_points_ledger`. Existing debit/credit and special-character reconciliation triggers are attached; they must not be reused for item trading without a proven migration-safe reconciliation.
- Current Kingdom `private.buklod_kingdom_items_v1(user_id,item_key,paid_shards,purchased_at)` is **not** a transferable item ledger; copying rows would duplicate ownership. Existing official Character collectibles/evolution receipts are likewise not trade certificates.
- Current `public.buklod_lifetime_points_for(user_id)` reads stored `lifetime_points`, and `get_my_buklod_character_selection_v2()` also derives character BP deltas from that lifetime total. Marketplace purchases must not mutate these fields.
- Live DB was inspected **read only**. No SQL below has been applied to it.

## DEV candidate schema / isolation

`supabase/changesets/buklod_world_exchange_v1.dev.sql` is an isolated-test-database-only candidate, **not** an applied migration. It introduces five private, RLS-enabled / direct-user-revoked structures: a dual feature gate (`trading_enabled=false`, `issuance_enabled=false` by default); verified source attestations with immutable unique event keys; item-instance ownership/custody; escrowed offers; and audited BP balance transfers. A trusted service-only source verifier is required before one item can ever be issued.

Public authenticated RPCs are limited to `buklod_world_exchange_status_v1`, `buklod_world_my_items_v1`, `buklod_world_browse_offers_v1`, `buklod_world_list_item_v1`, `buklod_world_buy_offer_v1`, and `buklod_world_cancel_offer_v1`. The client `src/lib/buklodWorldExchangeV1.ts` accepts only the app's existing authenticated `rpc` transport and contains no money/item write fallback or privileged key.

- Each item instance has one source and owner; only trusted verifier can issue it, and a user cannot create it by uploading a filename, locally completing Kingdom, or presenting an unverified game result.
- Only `gear`, `strategy`, or `material` may be tradable; progression/evolution receipts, cosmetic ownership, and match-only drops remain nontradable. Permanent hero-exclusive items still require that hero's rank/level eligibility before use.
- Listing locks the exact instance once. A purchase runs under PostgreSQL transaction/row locks, verifies both active accounts, exact item/source state, funds and buyer restrictions, transfers existing BP atomically, transfers ownership once, and records unique request IDs. Cancellation releases custody; failed payments leave existing ownership and balances unchanged.
- Evidence revocation must quarantine open offers. Already-settled disputed transactions require an audited process; no arbitrary double-deduction or invalid wallet reversal.
- No per-message spam, self-trade, forged client account ID, item purchase pretending to be BP award, or bonus lifetime points for moving a token through multiple accounts.

## Real-world integration blockers (do not bypass)

1. Verify the design against concurrent DEV branches and official Character Evolution #1041; do not convert existing 1,300 collectible art slots into mintable goods without a separate verified tradeable-instance source.
2. Build signed, **server-side** Kingdom/Arena/Community source adapters with real authority records. No independent verified source adapter is live in this candidate.
3. Generate an actual numbered migration via the approved Supabase CLI **in a separate isolated test database**, execute it and run `supabase/tests/buklod_world_exchange_v1_contract.sql` plus authenticated RLS, anonymous, stale/revoked receipts, same buyer retry, simultaneous competing buyers, transfer conservation, and lost-network-response tests. Do not apply to production.
4. Validate security invoker/definer privileges and Supabase schema exposure; no `service_role` credential in app/HTML. Perform database advisor review after isolated test execution.
5. Implement real authenticated Market & Inventory UI, cross-cluster membership/strategy treasury roles, separate Character/Empire admission gates, battle settlement isolation, QMP boundaries, counterparty disputes and privacy. HTML remains offline practice and cannot credit a wallet.
6. Only after verified backend and mobile RC gates, stage through DEV→verified RC→owner-authorized production release. No automatic OTA, live BP balance change, account migration, game economy reward or QMP activation occurs from this source commit.

## Focused checks

```bash
node --test tests/buklod-world-exchange-server-contract-20261121.test.mjs
```

These are **contract/client tests**, not live database execution. Unapplied SQL is not proof of production readiness; mark all integration/authorization/RC evidence separately.


## DEV V1.1 hardening: canonical asset bindings and concurrent requests

The candidate now seeds a **private 65-row allowlist** (13 real Character IDs × five Arena equipment slots) drawn from the existing V2 armory, with each slot bound to its exact immutable `hero:Lxx:I03` key and minimum Character level. This catalog is not itself proof of ownership: only server-issued independent verified-source certificates may be minted; the protected 1,300 story/evolution items remain nontransferable. The source table uses a composite foreign key to reject mismatched hero/slot/art keys, and its immutable identity trigger rejects changing actor, provenance, item kind, level/tier, proof or character. Issued item pointers and source revocations cannot be reversed.

The server verifier has only direct `SELECT, INSERT` on verified sources; it must call narrowly-scoped issuance and quarantine routines for later state transitions. Buyer request keys are serialized by a transaction-scoped advisory lock before checking settlement receipts (even when the same request key is sent against two different offers). Seller listing creation is serialized across all their items, enforcing the maximum 30 simultaneous offers. Both operations preserve deterministic row locking, rollback and unique receipt constraints. The thin client now validates remote item/offer shapes, request keys and the echoed offer ID, rather than silently treating malformed RPC data as confirmed inventory.

**Still blocked:** isolated PostgreSQL DDL/auth/RLS/concurrency execution, trusted event adapters and direct item-verification, independent audit/reconciliation, real-world rollout. A passing source/Node contract is not evidence of database correctness. Live feature flags remain OFF and no production DB/OTA changes are permitted from this candidate.

### V1.2 item-lock and source integrity additions

All operations targeting an issued item now take the **same transaction-scoped item advisory lock before their offer/item row locks**, including list, buy, cancel, and trusted quarantine. The buyer additionally takes a buyer/request-key advisory lock to serialize retries across different offers; seller listings take a seller-scoped advisory lock to preserve the 30-offer quota. The quarantine routine re-reads newly issued item IDs after waiting for the source row, preventing missed in-flight issuance. The verified-source insert/update trigger rejects pre-issued/pre-revoked source inserts, forbids changing item identity/provenance, forbids reassignment of the issued pointer, and permits revocation only once. Catalog seed mismatch fails migration rather than silently introducing a forged or stale character item mapping.

The **runtime client** independently checks that each item or offer belongs to the correct 13-character / five-slot / exact level mapping and that returned settlement `offer_id` matches the requested offer. These checks are defense in depth, never a substitute for server ownership authorization.

**Remaining mandatory gates:** Postgres transaction tests with two simultaneous buyers and buy-vs-cancel-vs-quarantine, missing-wallet/new-member seller activation policy, end-to-end source signature/attestation and dispute reimbursement, actual SQL parser/DDL execution, separate RC. Only local Node contract checks are currently executable; no production records were changed.