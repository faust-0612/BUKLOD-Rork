# BUKLOD Organization / Cluster governance + Focus Apps premium

Implementation report for the addendum covering My Cluster relocation, Cluster membership gates, accountability, progress reporting, Organization oversight, cross-Organization access, System Admin control, Bayanihan on Organization Home, Focus Apps drawer, and ₱59/month + ₱499/year pricing.

This extends `BUKLOD_ORG_CLUSTER_COMMERCIAL_MODEL_REPORT.md`. Cluster Premium ₱49 and lesson packages (CCP ₱49, Discipleship ₱59, Mentoring ₱69) stay separate from Focus Apps.

## My Cluster relocation

- Profile no longer has a duplicate **My Cluster** quick action.
- Profile **Organization** opens Organization Home (`/scope?section=home`) when the user has an active Organization membership.
- Organization Home now shows **My Cluster**: current Cluster + role + Cluster Home, or a **Join a Cluster** request path.
- Cluster Home and `/clusters` remain the join/request surfaces. No silent Cluster assignment.

## Cluster membership gate

Daily Bible Reading, Daily Devotion, and BUKLOD Lessons require an **active Cluster**. Organization membership is not enough.

- Server: `buklod_user_formation_context_v1`, `buklod_require_active_cluster_membership`.
- Write trigger on `daily_bible_submissions`, `learning_lesson_responses`, and `learning_progress` (when those tables exist) refuses official progress outside a Cluster.
- Faith access overlay (`buklod_scope_faith_access_status_v1`) now returns `has_active_cluster`, Cluster name/role, and unlocks packages only after Cluster membership.
- UI gates: `/bible`, `/word`, Learn tab, SHOW FAITH cards.

## Approval / accountability

Existing Cluster-scoped approval is kept and extended:

- Approvers: Cluster Mentor, Pastor, Cluster Admin/Head in **that Cluster only** (`buklod_is_cluster_approver`).
- `buklod_approve_cluster_formation_item_v1` now also accepts `DEVOTION_WORD`.
- Learners must be active members of the same Cluster. Members cannot self-approve.
- Unrelated Cluster leadership cannot see or approve the member.

## Cluster progress reporting

- New **General Progress Report** at `/clusters/progress`.
- RPC: `buklod_cluster_general_progress_v1` + member drill-down `buklod_cluster_member_progress_v1`.
- Visible to Cluster leadership, parent Organization Admin, granted external Org (with `cluster_reports`), and System Admin.
- Existing faith monitoring summary also opens for Cluster approvers, not only scope admins.

## Organization oversight

- `/organizations/clusters-oversight` lists every Cluster under that Organization: leadership, member count, Cluster Premium, pending approvals, progress drill-down.
- RPC: `buklod_organization_clusters_oversight_v1`.
- An Org Admin does not automatically see unrelated Organizations.

## Cross-Organization access

New table `buklod_organization_access_grants` with:

`requesting_org_id`, `target_org_id`, `requested_by`, `approved_by`, `permission_scope[]`, `status`, `requested_at`, `approved_at`, `revoked_at`.

Statuses: PENDING → APPROVED / REJECTED, then REVOKABLE.

RPCs: `buklod_request_org_access_v1`, `buklod_review_org_access_v1`, `buklod_revoke_org_access_v1`, `buklod_list_org_access_v1`, `buklod_has_org_access_grant_v1`.

UI: Organization Home → Org access (`/organizations/cross-access`).

Access is never automatic. Grants are permission-scoped, not a single unrestricted boolean.

## System Admin dashboard

- New **Org / Cluster Control Center**: `/admin/org-cluster-control`.
- Linked from Admin → Operations & Governance.
- RPC `buklod_system_admin_org_cluster_center_v1` reuses existing scope, membership, role, grant, and product tables instead of duplicating member-master / command-center.

Shows Organizations, Clusters, leadership assignments, cross-org grants, and lifecycle audit.

Existing pages remain: member-master, foundation-access, faith payments, Bayanihan admin, command center.

## Suspension / deletion

RPC `buklod_admin_lifecycle_action_v1` with strong reason requirement:

- suspend / reactivate Organization
- suspend / reactivate Cluster
- suspend / reactivate user membership access
- remove role assignment
- soft-delete Organization / Cluster (`metadata.lifecycle_status = DELETED`)

Audit table `buklod_admin_lifecycle_audit` stores actor, action, target, timestamp, reason.

Payments, entitlements, approvals, and activity history are not destroyed.

## Bayanihan on Organization Home

Organization Home includes a **BUKLOD Bayanihan** card that opens the existing `/bayanihan` portal (request, status, points vs ₱ ledger kept separate). Policy copy was added on the Bayanihan screen. Existing Bayanihan admin and ledgers were reused.

## Focus Apps drawer

Profile section is now a **BUKLOD Focus Apps** drawer listing available apps, lock state, and ₱59/month + ₱499/year.

Full plans screen: `/profile/focus-apps`.

Gated portals redirect to that screen instead of silently bouncing to Home.

Attendance, Giving, and Organization admin stay exempt from this subscription.

## Pricing: ₱59/month and ₱499/year

| Product | Amount | Billing | Scope |
|---|---|---|---|
| `organization_focus_apps_monthly` | ₱59 | MONTHLY | Organization |
| `organization_focus_apps_annual` | ₱499 | ANNUAL | Organization |

- Old **₱249/year is no longer sellable**. Catalog, payment UI, admin copy, and RPC amounts now use 59 / 499.
- Historical ₱249 payment rows are **not rewritten**.
- Either monthly or annual ACTIVE entitlement unlocks gated Focus Apps for that Organization only.
- Expired subscription relocks via `buklod_expire_annual_entitlements_v1` (now also expires MONTHLY).
- Does not unlock other Organizations, Cluster Premium, or lesson packages.

## Permissions matrix

| Role | Can | Cannot |
|---|---|---|
| Member | Use Cluster features when joined + entitled; see own progress; submit | Approve others |
| Cluster Mentor / Pastor | Assigned Cluster members, approvals, progress report | Other Clusters |
| Cluster Admin | Manage Cluster; progress; approvals if authorized | Other Clusters |
| Organization Admin | Manage Organization; inspect all Clusters in that Org | Other Orgs without a grant |
| Granted external Org | Only listed `permission_scope` on the target Org | Anything not granted |
| System Admin | Global structure, activity, suspend/delete with audit | Silent destructive wipes |

## Migrations / RPCs

Created:

- `scripts/db-reconcile/20260827180000_org_cluster_governance_premium.sql`
- `supabase/migrations/20260827180000_org_cluster_governance_premium.sql` (same file)

Key new/replaced RPCs: formation context, Focus Apps monthly+annual access, Cluster progress, Org oversight, cross-org grants, System Admin center, lifecycle actions, faith access overlay, product access snapshot.

Reused: `buklod_is_cluster_approver`, `buklod_approve_cluster_formation_item_v1`, commercial product/entitlement/payment tables, Bayanihan screens.

## QA

Automated:

- Catalog tests updated: annual ₱499, monthly ₱59, ₱249 not advertised as live price.
- `tsc --noEmit` run after implementation.

Manual (requires linked SQL):

1–4. No Cluster → Daily Reading / Devotion / Lessons gated; join/request works from Organization Home and `/clusters`.
5–9. Joined member visible to that Cluster’s Mentor/Pastor/Admin; unrelated Cluster blocked; progress report scoped.
10–15. Org Admin oversight + cross-org request/approve/reject/revoke.
16–22. System Admin center: orgs, clusters, leadership, audit, suspend/reactivate.
23–24. Bayanihan card on Organization Home + policy copy.
25–32. Focus Apps drawer, lock, ₱59/₱499, no live ₱249 CTA, verified unlock, expiry relock, Cluster Premium remains separate.
33. Historical payments untouched.
34–36. TypeScript; web/Android native binary not required for this JS pass. SQL must be applied before production JS that depends on new RPCs.

## Remaining deployment requirements

1. Apply `scripts/db-reconcile/20260827180000_org_cluster_governance_premium.sql` to the linked Supabase project (`npx supabase db query --linked --yes --file ...`).
2. Do **not** OTA until that SQL is on the target environment. New RPCs are required.
3. No production native rebuild is required for this pass.
4. Historical ₱249 entitlements remain valid until their existing `expires_at`.
5. System Admin canonical break-glass account remains `efmagaj@gmail.com`.
6. iOS Focus Apps / ATT is unchanged and still a separate native review if ads or ATT are later required.

No ads, chat, giving, attendance, Bible reader, or lesson curriculum tables were rebuilt. No production data was deleted.
