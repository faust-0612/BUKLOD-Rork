# BUKLOD WORLD — BACKEND IMPLEMENTATION / MIGRATION CONTRACT (NOV 21 2026)

Status: **DEV ENGINEERING SPEC, NOT APPLIED TO ANY DATABASE**. No Supabase development branch exists in the inspected connected project. Its display name is "BUKLOD Connect" (project ref `yhanxndaqbmuzbdqlblu`); do not assume a separate writable Genesis staging database. A project/branch and release authority must be identified before applying migrations. Never write new World tables to the shared live backend merely because a DEV UI exists.

## Reconciled canonical integrations

Read-only schema inspection found:
- `public.buklod_points_ledger`: `id,user_id,direction,points,activity_type,source_key,source_id,claim_state,created_at`. **This, plus its existing safe award/claim RPCs, is the origin of personal BP.** Do not replace, rename, or mass-update it.
- `public.buklod_scope_memberships`: `scope_id,user_id,membership_status,joined_at,left_at`; validate eligible membership **at the time** an earning receipt was created, and designate exactly one recipient Cluster.
- `public.buklod_homes`, `buklod_home_members`, `buklod_home_communities`: reuse for household social roles, room communication and gardens. World spatial house attaches via optional `buklod_home_id`, never copies private household messages/files.
- `public.buklod_community_post_meta` includes `kind, challenge_config`. Existing posts are discoverable social invitations, not evidence of real-world completed work.
- The existing Supabase project also has QMP and cash-finance RPCs; new World QMP contracts are **not connected** to them until audited, versioned Finance cutover.

Confirmed migration dependency checks required prior to applying:
- Precise parent scope ownership tables and authorization RPC signatures for Cluster/Organization must be read and validated.
- Current point balance/lifetime rank computation and `claim_state` semantics must be checked. A BP gift or market transfer CANNOT be inserted as an ordinary earned-credit row that existing lifetime-rank queries would count.
- Verify which original activity classes yield canonical BP (some rewards may be pending/claimed/reversed). Community BP grants cannot be based on stale or unsigned raw client actions.
- Check existing `buklod_home_communities` subdivision and garden operations to prevent duplicate feature authority.

## Proposed isolated schemas (prepare after safe remote staging is available)

All new internal economic data is initially in a non-exposed `world_core` schema with explicit least-privilege grants, versioned immutable receipts and no public client writes. Exposed read APIs may use `world_public` with security-invoker views and explicitly filtered privacy fields. Every exposed table has RLS, restrictive policies and no blanket authenticated writes.

1. `world_core.world_regions`: immutable world id, map coordinate system and bounded districts.
2. `world_core.land_parcels`: parcel id, region id, virtual geometry/bounds, area_m2, zone, availability state and stable revision. Use Postgres overlap exclusion constraint (spatial extension only if approved) or a transactionally locked integer grid/parcel allocator. **No sold parcel overlap**.
3. `world_core.property_titles`: parcel id, personal or Cluster/Organization owner scope, acquisition receipt id, fractional shares if co-owned, valid from/to, optimistic version. A guest is NOT an owner. No real land deeds.
4. `world_core.property_structures`: plot id, blueprint id, tier and substage, footprint/placement bounds, production asset pack and last verified construction receipt; foreign keys to parcels and approved item catalog.
5. `world_core.property_scenes`: building/room id, revision integer, approved asset manifest pack, validated palette masks, decoration slot placements. CAS writes, scene diff history, owner-only/private access. Renderer receives only appropriately redacted visible room layers.
6. `world_core.item_catalog` / `item_price_versions` / `blueprint_recipes`: SKU, item category, units (piece/kg/liter/bundle/box/sqm etc), integer pricing basis, approved cost, bundle count, immutable price revision, asset provenance and public launch flags. Quantities stored as scaled integers, not floating-point wallet values.
7. `world_core.inventories` / `inventory_entries`: owner scope + sku + quantity, backed by double-entry supply/consumption/transfer receipts. No client-controlled stock grant.
8. `world_core.bp_provenance_lots`: canonical source earning receipt reference, current holder scope, remaining BP, unused QMP-eligible BP rights, origin period, revision and last committed movement. **BP cannot be purchased** and cannot be minted by an external payment.
9. `world_core.bp_transfer_receipts` / `bp_purchase_receipts`: idempotency key, buyer/seller ids, debit/credit split, inventory/title delivery, usage of QMP eligibility, policy version and reversal relation. Atomic row locks; BP gifts increase Available BP but never Lifetime Earned BP/rank.
10. `world_core.qmp_spend_candidates`: qualified BP spend, consumed eligibility, monthly/category caps, receipt/actor/source, risk and refund status; **not** a Finance posting table until cutover gate explicitly approved. Prevent repeated QMP credit on circulating BP that has already been used for a valid purchase.
11. `world_core.community_bp_accounts` / `community_bp_journal`: separate Cluster and Organization treasury BP accounts, immutable source progress receipt or challenge award, credited, spent and reserved balance; no member wallet owner.
12. `world_core.community_bp_grants`: **unique original member earning receipt across all eligible Cluster scopes** + designated scope, source verified membership, issuance policy and monthly cap; optionally previous verified month earned BP cumulative for small honest actions. Grant creates community BP only once; no personal BP debit.
13. `world_core.community_projects` / `world_challenges`: challenge goal, certified participants, measurable outcome, rubric version, safety/permit requirements, opening/closing dates, sponsoring Cluster and prize amount; freeze terms after challenge acceptance.
14. `world_core.challenge_award_reservations` / `challenge_award_journal`: sponsor-community treasury reserved amount, immutable challenge id, recipient community id, independent final review decision, appeal status. Winning Cluster gets treasury BP; losing Cluster and personal wallets do not pay stakes. **No other award funding source silently eligible**.
15. `world_core.challenge_evidence` / `challenge_reviews`: hashed private storage references, evidence kind (baseline/progress/completion/permission/issuer-confirmed certificate), upload owner/time, chain of custody, verified independent assessor, conflict-of-interest flags and immutable audit receipt. Public Wall sees redacted summaries only.
16. `world_core.world_activities` / `activity_participants` / `invites`: opt-in short-lived social presence, discovery and collaborative activities, security-safe consent. No geographic tracking by default, no unrestricted adult/minor stranger chat, no private DM content mining.
17. `world_core.world_elections` / `ballots` / `governance_receipts`: elective **virtual** community authority; never conflated with government Focus App agency role authorization, Character rank or real-world civil elections.

## Server API boundaries

**Allowed reads:**
`get_world_public_map_tiles`, `get_public_world_destinations`, `get_visible_property_scene`, `get_world_item_catalog`, `get_world_blueprint_requirements`, `get_my_virtual_land`, `get_my_world_bp_wallet_summary`, `get_my_eligible_qmp_receipts`, `get_cluster_treasury_public_summary`, `get_my_challenge_submissions`. All bounded paginated/scope-guarded, private evidence excluded.

**Privileged writes (must run through trusted server/controller transaction):**
`reserve_world_land`, `commit_world_land_purchase`, `reserve_world_item_quote`, `settle_world_item_purchase`, `apply_world_construction_step`, `save_world_scene_revision`, `settle_world_peer_trade`, `settle_world_bp_gift`, `grant_cluster_bp_from_signed_member_receipt`, `reserve_cluster_challenge_award`, `mark_project_evidence_review`, `finalize_world_challenge`, `transfer_reserved_cluster_bp_award`, `reverse_world_purchase_and_qmp`. Names are contracts, not existing RPCs.

Security: using `SECURITY DEFINER` in a public exposed RPC is dangerous; don't expose internal balance-changing functions to `anon` or `authenticated`. Prefer a scoped service authenticated server over a private schema, explicit grants, narrow functions with validated `auth.uid()` and membership, role/scope checks sourced from server-approved tables. Revocation and transaction audit required. The client must never supply its own verified flag, BP provenance, legal role, project completion verdict or winner id.

## Required transactions / invariants

- **EARN BP**: use canonical verified reward receipt, credit own Available and Lifetime Earned BP *once*. Community grant derived separately once from that source, no personal debit.
- **GIFT BP**: move existing BP from sender to receiver; increase receiver's Available BP only. Preserve QMP-eligible unused rights on gifted BP lots, no automatic rank/XP/QMP. Optional sender gift penalty remains UNAPPROVED.
- **BUY ITEM / LAND / UPGRADE**: transactional debit spendable BP, move inventory/title/structure or deliver finished upgrade. Candidate QMP from genuinely unused original BP purchase rights; material purchase and later item consumption cannot create duplicate QMP. If peer seller gets BP, that returned BP has spent/exhausted QMP rights to stop circular QMP farming. Declined/missing delivery = no debit or candidate QMP.
- **COMMUNITY AWARD**: reserve fixed BP in host Cluster treasury, independent assessment, immutable award record, transfer sponsor reserve to winning community treasury. Personal wallets/XP/QMP untouched; loser no stake; sponsor wins => release reserved amount to its original balance with no duplicate award.
- **REFUND/REVERSE**: restore original BP lot/source eligibility as valid, reverse QMP candidate if not finalized; after month finalization adjust only under approved future-period clawback policy without rewriting finalized user cash.
- **PROPERTY EDIT**: only owner / explicitly permitted decorator may change scene. CAS revision, allowed asset entitlement, slot collisions, valid land footprint; save never edits property title, member roles or financial BP.
- **PROJECT EVIDENCE**: issuer confirmation through independent contact verification, before/after with qualified neutral reviewer, check reused hashes and suspicious EXIF/time, independent final audit and dispute window. All proofs can be forged; require layered verification and risk escalation. No "100% fraud-proof" claim.
- **CLUSTER BP issuance**: no double-mint from one receipt across overlapping memberships. Cap per event/member/community/period; monitor issuance-to-sink ratio. Organization BP cannot inherit same receipt twice.
- **GAME / FAITH**: Character System remains the canonical XP/items/badges authority; faith-off members have equivalent non-faith verified participation routes.

## Backend build / QA order

1. Establish a non-production database branch with approved cost and correct schema baseline. **Do not migrate the connected production/shared project in this design pass.**
2. Verify canonical migration order and current changelog. Supabase CLI v3 changed default targeting to local. Use explicit target flags and a generated migration filename from CLI, not guessed names.
3. Introduce feature-gated, deny-by-default tables and read-only privacy-filtered views; run RLS allow/deny tests for anonymous, member, visitor, leader, system admin.
4. Build immutable ledger and provenance model, stress test concurrent purchase/refund/transfer, idempotency, replay and large-number overflow.
5. Add community BP grants and treasury with verified signed source receipts, caps and challenge award reservations; never write new ledger into legacy earned personal rank.
6. Add parcels, inventory, blueprints, structures and scene CAS, then social visits under existing Bahay permissions.
7. Add encrypted/private evidence storage, auditor independence checks and dispute governance; separate evidence readiness from final payout authorization.
8. Integrate approved premium layered world assets only after SHA256/license/provenance and Android memory/FPS evidence. Never ship temporary low-grade map as production artwork.
9. Dry-run QMP Finance and real revenue eligibility with 3 closed months and 1 open month of bounded aggregates; zero personal QMP for Cluster award; no historical payout mutation.
10. Verify DEV → RC/staging APK/OTA, first-view AdMob and tab-navigation regression, and only after release approval publish production. No new Expo native deps presumed by the current pure contracts.

## Explicit blockers currently open

- No confirmed isolated Supabase dev branch / migration dry-run environment.
- Exact owner-approved QMP formula, per-category caps, new Season activation and gift-penalty rule still require Finance validation.
- Premium original 2.5D/3D map / interior / farm assets with layered masks, LOD and device rendering verification are not shipped.
- No compiled Android UI / Jest or real-time multiplayer validation yet.
- Legal/platform policy review for competitive community awards with indirect revenue-share implications is pending.
- Real-world verification cannot be made mathematically impossible to fraud; independent field checks and redress are mandatory.

This file deliberately does **not** include executable migration SQL or connect client transfer methods to production; doing that before the staging baseline and security checks would be unsafe.
