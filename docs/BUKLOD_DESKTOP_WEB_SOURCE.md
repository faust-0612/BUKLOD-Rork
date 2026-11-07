# BUKLOD Main — desktop web source of truth

**App identity:** `APP_ID=buklod-main`
**Repository:** `faust-0612/BUKLOD-Rork`
**Production web:** `https://buklod.expo.app` (Expo Hosting)
**Release workflow:** `.github/workflows/production_web_deploy.yml` (manual workflow_dispatch on `main`)
**Deployment policy:** inspection or DEV edits must not trigger production web or Android OTA.

## Source ownership

| Concern | Canonical file |
| --- | --- |
| Route + viewport policy | `src/lib/buklodWebResponsivePolicy.ts` |
| Root web shell switch, auth self-heal, Focus ad strip | `src/components/BuklodNavSafeShell.web.tsx` |
| Public browser shell and phone nav | `src/components/BuklodMobileWebShell.tsx` |
| Organization/Cluster desktop shell, focus mode, sponsor rail | `src/components/BuklodDesktopWebShell.tsx` |
| Public Home/Wall feed width and tab stack | `src/app/(tabs)/_layout.tsx` |
| Canonical Home contents | `src/app/(tabs)/hub.tsx` |
| Canonical Wall contents | `src/app/(tabs)/buklod.tsx` |

## Responsive contract

- Under **1100px**, use the mobile web shell.
- At **1100px or wider**, scoped `/scope` workspaces use `BuklodDesktopWebShell`, subject to its navigation rules. Scoped auth and privacy remain unchanged.
- Public/personal routes keep their **minimal public shell at every width**. They must not suddenly inherit old desktop navigation.
- At **1200px or wider**, the public `/hub` and `/buklod` screens use a **centered, max-940px** feed canvas; there are no empty decorative left/right `View` rails.
- Android/iOS never consume desktop-specific presentation changes.
- The `/home` compatibility alias still redirects to `/hub`; no duplicate Home engine.

## Editing procedure

1. Reconcile `main` with latest verified DEV/RC before changing shared components.
2. Edit the component that owns the behavior; avoid new overlapping layout wrappers.
3. Run `node --test tests/buklod-desktop-web-source-20261107.test.mjs` and the normal TypeScript/navigation checks before merging.
4. Release Expo Hosting only after an independent web RC and deployment verification. Do not treat a Vercel Classroom preview as BUKLOD Main web.

The BUKLOD Classroom Vercel project is not the BUKLOD Main production web target.

## Approved 2026-11-07 dashboard design — implementation

At 1200px and wider, selected authenticated public dashboards mount
`src/components/BuklodPublicDesktopDashboard.tsx` from
`BuklodNavSafeShell.web.tsx`. This **replaces the mobile bottom navigation
pane** with left-side actual route buttons. Outside the selected dashboards
(login, policy, call, full-screen media, scoped screens), the original layout
and permissions are preserved.

Visual reference: user-supplied BUKLOD three-column mockup. The extraneous
tall far-left external ad was explicitly removed from the approved scope.

- Center: existing routed screen with max-width canvas; Home includes welcome,
  Quick Actions, real Today, actual Wall composer handoff, expandable updates,
  and on-demand tools. Wall retains its original paged feed/video engines.
- Left: Home, Cluster, Wall, Connect, Profile, Bible, account-bound
  `BuklodCommunityContributionCard`, and genuine sponsor inventory.
- Right: account-bound recent personal threads and contacts, direct row
  navigation, call-entry via the real Connect inbox, notifications, and
  sponsor inventory. No fabricated chat, active-user, financial or ad metrics.
- Header: BUKLOD branding, screen name, people/chat search routed to the
  actual Connect search, notifications, account avatar.

The right rail intentionally does not claim to show call history, presence or
community impact counts unless a real permitted data source exists. All buttons
either navigate to live underlying functionality or select a real view.
The existing Android/phone web bottom navigation is unchanged.

**Release boundary:** Source-only DEV changes. No Expo deploy, Vercel deploy,
Android OTA, DB migration or backend RPC mutation is part of this change.
Before publication, verify desktop widths 1200/1440/1920, phone web, Cluster
routing, web auth, scoped account switching, and original Wall media.
