# Canonical BUKLOD Home surface ownership (2026-11-09)

There are four distinct concepts; don't infer ownership from the word "Home".

| Surface | Canonical route | Purpose | Finance |
|---|---|---|---|
| BUKLOD Hub | /(tabs)/hub | Public app tools, news, daily content, contribution preview, access to My Earnings | Personal QMP preview only; link to personal account |
| Scope Home | /scope?section=home&scopeId=... | Cluster/Organization workspace, scoped content/members/attendance/calls | Scoped fund only, verified via membership-bound RPC |
| BUKLOD Bahay | /personal-home | Household rooms, members, garden, privacy | No community or personal wallet mounted |
| Retired Public Home | /(tabs)/home | Historical compatibility alias | Never mount; router redirects old deep links |

Personal earnings, payouts and the contribution destination selector belong in /bayanihan.
The contribution/QMP drill-down belongs in /community-contribution.
There is only one personal wallet across all communities. A scope fund belongs to that
scope, never to its individual members. The household must not leak financial state.
Do not show the platform's gross AdMob revenue, internal pool percentages or formulas
in ordinary user-facing screens.

Contribution destination selector:
- Eligible user sees only current active root-Organization or Cluster memberships.
- Server RPC public.set_my_buklod_community_destination_v3 rechecks earning qualification,
  membership, active scope, uniqueness and switch lock.
- Existing backend currently configures a 30-day lock.
- A user can choose one destination only; no stacked 5% + 7% allocations.
- Prior finalized financial ledger entries are never rewritten on a switch.
- Sub-organizations cannot be independent destination wallets; parent root organization
  is eligible only if the user independently has active membership there.
- Selection is a two-step action with explicit confirmation and backend-verified success.
- Account changes clear local chooser state. All sensitive values are scoped by RPC auth.

Release: DEV changes only; stage and test before RC and production OTA.
