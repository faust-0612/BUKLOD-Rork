# Cluster Connect Desktop Compact and Sidebar Exit R1 — 2026-11-07

Source base: authenticated GitHub Main at `3ead9e9a2ce707b10fa9c53aa17d39f3b1e5ebaf`. User screenshots are visual evidence; they do not prove the live source commit.

## Root-cause analysis
- Cluster/Organization Connect currently renders the shared `BuklodConnectThread` under an unrestricted `flex: 1`, so a large message or media item expands throughout the routed center.
- Left sidebar requests immediately route after `await selectScope(PUBLIC)` while `BuklodCanonicalNavigationGuard.web` can still observe the previous managed scope during React state commit and redirect global Home/Wall/Connect back into `/scope`. This is a UI transition timing conflict, not a permission to bypass Cluster access.

## Chosen implementation
- Desktop (web >=1200px) Cluster/Organization Connect initially renders at **340px high**, max width **740px**, within the existing center column. The card shows Quick Chat, Expand / Collapse. Expand reuses the **same mounted** authenticated scope Connect engine; it enlarges only inside the Main Web center, never replaces the Main desktop chrome. Pressing Chat Back from expanded mode collapses before leaving.
- Phone web/native continue to render the full existing scoped Connect thread; no new service, no message duplication or schema change.
- Side nav converts a managed-scope exit into a user-bound, latest-click-wins pending destination, performs the existing authorized `selectScope(PUBLIC)`, and commits navigation only when the provider confirms active scope PUBLIC. This prevents bouncing to Cluster on a stale state. On failure the sidebar provides clear Retry text; no unverified public state is displayed. Scoped view uses `replace` to leave its entry in the back stack.
- The left rail has an explicit hit area above the center panel; profile/Connect dock and contribution cards remain intact.

## Preserved behavior
All existing Cluster/Organization authorization checks, message attachments, calls, composer, admin features, profile settings, and public Wall functions are preserved. No mobile changes, database migrations, Expo production publication, or Android OTA from this DEV branch.

## Release
DEV -> focused regression and TypeScript / Expo web export -> reviewed Main -> verified exact RC -> manual production web deploy. Do not re-run a failed old SHA or present source merge as live publication.
