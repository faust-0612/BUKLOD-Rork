# BUKLOD Organization / Cluster commercial model

Implementation report for the coordinated Organization, Cluster, pricing, lessons, approval, Church registration, and Focus App subscription change.

## Entitlement rules

- Organization registration stays free.
- `organization_focus_apps_annual` — ₱249/year per Organization. Expiration is calculated server-side. Renewal extends one year from `max(now, expires_at)`. Expired subscription blocks premium Focus App portals only.
- `cluster_premium` — ₱49 per Cluster (one-time). Unlocks Daily Bible Reading for eligible Cluster members.
- `cluster_lessons_ccp` — ₱49 one-time. Unlocks 101–103.
- `cluster_lessons_discipleship` — ₱59 one-time. Unlocks 104–105.
- `cluster_lessons_mentoring` — ₱69 one-time. Unlocks 106–107.
- Payment is per Cluster / per Organization. Members inherit access. Clients cannot self-grant.
- Unique pending payment per `(scope_id, product_code)`. One-time products stay purchased.
- Church is Organization type `CHURCH`, not a parallel scope system.

Gated Focus Apps (₱249/year): Faculty, Business/Commercial, Local/Government, Family, Health, Market/Palengke.

Exceptions preserved: Attendance, Giving, Organization admin/manage.

## Old pricing removed / deprecated

- Per-stage ₱100–₱1000 lesson unlock UI replaced by Cluster packages.
- Daily Reading / Devotion ₱50 member pay CTAs removed. Members see Cluster Premium copy.
- Focus App default ₱500/year replaced by ₱249/year Organization subscription.
- Historical payment rows are not deleted. Existing per-app ₱500 subscriptions are **not** auto-mapped to ₱249 (not equivalent). Flag for admin review if needed.

## Church registration / geolocation

- `Find a Church → Register a Church` routes to Register Organization with type `CHURCH`.
- Structured address is geocoded with expo-location, then Nominatim. Coordinates are stored on `buklod_organization_locations` and reused (not geocoded on every page load).
- Find a Church queries Church-type Organizations via `buklod_find_church_organizations_v1`, merged with the existing accountability search. Non-church Organizations are excluded. Missing coordinates do not crash Nearby.

## Approval security

- Official credit is Cluster-scoped: Cluster Head / Cluster Admin, Mentor, Pastor in that Cluster only.
- Members cannot self-approve.
- If no authorized approver exists, the formation queue shows a setup message instead of auto-approving.

## Migrations / RPCs

Created:

- `scripts/db-reconcile/20260827120000_organization_cluster_commercial_model.sql`
- `supabase/migrations/20260827120000_organization_cluster_commercial_model.sql`

Tables: `buklod_commercial_products`, `buklod_scope_product_entitlements`, `buklod_scope_product_payments`, `buklod_organization_locations`, `buklod_cluster_formation_approvals`. Column: `buklod_scopes.organization_id`.

Key RPCs: `buklod_create_cluster_v2`, `buklod_scope_product_access_v1`, `buklod_submit_scope_product_payment_v1`, `buklod_admin_review_scope_product_payment_v1`, `buklod_can_use_organization_focus_app_v1`, `buklod_scope_faith_access_status_v1` overlay, `buklod_register_church_setup_v1`, `buklod_find_church_organizations_v1`, `buklod_approve_cluster_formation_item_v1`.

Orphan Cluster create is rejected after migration. Legacy Clusters without a parent Organization are preserved with `needs_organization_link`.

## QA

- Unit tests added in `__tests__/buklodCommercialCatalog.test.ts`.
- Local `jest` binary was not installed in this workspace (`jest` not recognized). Catalog rules were reviewed against the source.
- Apply SQL with: `npx supabase db query --linked --yes --file scripts/db-reconcile/20260827120000_organization_cluster_commercial_model.sql`

## Manual Supabase configuration

None beyond applying the SQL file above. GCash number remains the existing faith/focus number. System Admin still verifies payment references.
