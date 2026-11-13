# BUKLOD — Nov 13 consolidated production OTA preparation (HOLD)

**Decision:** Prepare only. **NO OTA, NO web deploy, NO APK/AAB, NO merge into `main`.** This document is an auditable inventory, **not a frozen verified RC**.

## Verified starting facts

- Canonical repository: `faust-0612/BUKLOD-Rork`.
- GitHub `main` at this inspection: `9f412afd71b74e41995a3a1a63e05e72f78b6e39` (source baseline only).
- Prior publisher evidence, recorded in the Nov 13 staging navigation contract: Android source `a43e1813d62a151e8294a52989a80fe21b36057c`, Android update `01a1d2d6-bae3-74df-bbf4-2bdd9df35215`, publisher run [43355306642](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/43355306642), Expo Web run [43355306645](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/43355306645). **This is not a fresh installed-device readback or confirmation that every newer change is live.**
- Android target: `org.mzbministry.buklod`, Expo runtime `1.3.2`, eventual channel `production` only. Web publication is **not** authorized by this request.
- Navigation staging candidate `dev/navigation-v2-staging-parity-20261113` was 68 commits ahead of then-current main in the initial comparison, but had incomplete acceptance. Comment fix [#786](https://github.com/faust-0612/BUKLOD-Rork/pull/786) passed focused source QA; it lives on a staging-derived, not production-approved, branch.
- Branch drift is material. No stale RC should be released wholesale. Multiple recent PRs overlap in `src/app/(tabs)/buklod.tsx` and ads, Connect, BSOC, media and navigation code.

## Candidates to reconcile — *not an assertion of inclusion or live status*

The PRs below are the observed recent work inventory. For each, inspect the exact latest `main` file state and implementation contract; if it is already present, do not duplicate it. Any source changes not yet reviewed/approved must stay out of the release.

| PR | Feature/workstream | Current preparation disposition | Guard |
|---|---|---|---|
| [#783](https://github.com/faust-0612/BUKLOD-Rork/pull/783) | Navigation 2.0 staging parity, accessibility and adaptive input | `HOLD_UNTIL_STAGING_ACCEPTED` | Staging source 68 commits ahead main at inspection; 21-category completion requires real evidence; native IME direct GIF still missing. |
| [#786](https://github.com/faust-0612/BUKLOD-Rork/pull/786) | Android Comment actions / own Edit and Delete | `INCLUDE_AFTER_FORWARD_PORT_AND_TEST` | Focused changes and source CI passed; staging branch advanced after base, forward-port only changed files with exact diff. |
| [#784](https://github.com/faust-0612/BUKLOD-Rork/pull/784) | Marites / Wall scroll decoder budget | `RECONCILE` | Avoid changing functional video playback; overlapping Wall source with other branches. |
| [#774](https://github.com/faust-0612/BUKLOD-Rork/pull/774) | Cluster Connect Sent versus confirmed Seen | `RECONCILE` | Confirm backend writes only for genuine viewed messages; preserve existing PTT and Org Seen. |
| [#773](https://github.com/faust-0612/BUKLOD-Rork/pull/773) | Remove Home BUKLOD Quiz card | `RECONCILE` | Do not move removed launcher to Drawer; retain Classroom quiz. |
| [#772](https://github.com/faust-0612/BUKLOD-Rork/pull/772) | Fast Wall upload, draggable music controls, ambiance | `RECONCILE` | Check GIF/media paths, video playback, Android file pickers and regression tests. |
| [#763](https://github.com/faust-0612/BUKLOD-Rork/pull/763) | Large native sponsor ads / composer | `RECONCILE` | Check source-aligned AdMob, viewport lifecycle, load callbacks and no overlay. |
| [#762](https://github.com/faust-0612/BUKLOD-Rork/pull/762) | Shared native ad viewport clock | `RECONCILE` | Potential overlap with #763 and earlier main ad safety changes. |
| [#759](https://github.com/faust-0612/BUKLOD-Rork/pull/759) | Ako Lang post privacy enforcement | `RECONCILE_SECURITY_CRITICAL` | Verify authorization and immediate visibility revocation against non-owner accounts. |
| [#758](https://github.com/faust-0612/BUKLOD-Rork/pull/758) | BSOC 429 fallback, intervention and SYS-500 context | `RECONCILE` | Preserve permissions, case threads, truthful fallback messaging and diagnostics. |
| [#757](https://github.com/faust-0612/BUKLOD-Rork/pull/757) | Jawo Forest Trail mobile/gameplay | `RECONCILE` | Protect legacy game state and point balances; isolate media/performance budgets. |
| [#756](https://github.com/faust-0612/BUKLOD-Rork/pull/756) | About BUKLOD founder story and presentation toolkit | `RECONCILE` | Separate admin-only material where applicable. |
| [#755](https://github.com/faust-0612/BUKLOD-Rork/pull/755) | Security Operations monitor / alert safeguards | `RECONCILE` | Preserve security escalation guard; no resumed recurring reports unless authorized. |
| [#754](https://github.com/faust-0612/BUKLOD-Rork/pull/754) | Green B brand + Suggested Login avatar | `RECONCILE` | Compare login dashboard and current branding; native icon may require APK/AAB. |
| [#748](https://github.com/faust-0612/BUKLOD-Rork/pull/748) | Admin priority request notifications | `RECONCILE` | Avoid duplicate queues; maintain case/action links. |
| [#743](https://github.com/faust-0612/BUKLOD-Rork/pull/743) | Nov12 consolidated BSOC/Seen/avatar/AdMob RC hold | `REFERENCE_ONLY_SUPERSEDE_WITH_FRESH_MAIN` | Old diverged RC cannot be deployed wholesale. |
| [#741](https://github.com/faust-0612/BUKLOD-Rork/pull/741) | BSOC actionable member replies and case routing | `RECONCILE` | Deduplicate #758 and other BSOC work. |
| [#740](https://github.com/faust-0612/BUKLOD-Rork/pull/740) | Cluster Seen, avatar repaint, ads safeguard | `RECONCILE` | Deduplicate #774, #762/#763 and existing main fixes. |
| [#739](https://github.com/faust-0612/BUKLOD-Rork/pull/739) | KL reading questions / Admin preview | `RECONCILE` | Preserve source-anchored quiz and approved point rules. |
| [#780](https://github.com/faust-0612/BUKLOD-Rork/pull/780) | SALIKSIK R2 learning/point vault | `CONDITIONAL_BACKEND_RC` | Includes SQL/functions/points; check migration history, permissions and reward double-credit safeguards before integrating. |
| [#787](https://github.com/faust-0612/BUKLOD-Rork/pull/787) | Modernization 30-reference blueprint | `DOCS_ONLY_NO_OTA_PAYLOAD` | Crosswalk planning, not evidence of UI implementation. |
| [#679](https://github.com/faust-0612/BUKLOD-Rork/pull/679) | Retired IGPAT fast playback | `EXCLUDE` | User retired IGPAT; do not reintroduce UI or publishing. Preserve historical media. |
| [#717](https://github.com/faust-0612/BUKLOD-Rork/pull/717) | Legacy IGPAT publishing recovery | `EXCLUDE` | Retirement supersedes IGPAT publishing. |

## One future Android OTA, not a stack of separate publishes

1. **Reconcile:** compare authoritative `main`, verified live production source, verified RC if any, all approved workstreams, and staging user parity. Record per-file provenance and resolve overlapping code semantically, not by cherry-picking stale copies.
2. **Integrate only compatible approved deltas:** no native IME/Gboard module, Android permission, package, runtime or AdMob SDK native change in an OTA-only payload; these need a separately verified binary track. Backend SQL/functions require independent security, migration and data-integrity checks.
3. **Hold the final candidate:** run source-specific protected-feature gates, TypeScript, test matrix, Expo Android compiled export and runtime compatibility tests. Do not reuse an earlier RC run when source SHA differs.
4. **Stage first:** verify staging-user baseline parity without copying live credentials, member data, financial records or notifications; test own-comment Delete/Edit, other-user denial, network retry, modern navigation, scrolling media, ads, Seen, BSOC and privacy.
5. **Publish later only on explicit release instruction:** freeze one exact RC SHA and prove target production runtime, channel, EAS project and source consistency before any OTA; record published update ID and installed handset behavior afterward.

## Mandatory no-regression exclusions

- IGPAT remains retired: no public IGPAT button or creation/player reintroduction; historical media preserved.
- Keep private `Ako Lang` enforcement and scoped RLS. No cross-user comment edit/delete.
- Do not mix non-AdMob app revenue into member AdMob distribution. No duplicate points or payout credits.
- Preserve existing Wall/Marites video behavior, weak-network buffering, media/GIF composer and ad placements; no heavy blocking overlays.
- Preserve PTT, Connect, authentication, native crash guards and Android Back, while modernizing navigation.
- Never imply a staging branch, a GitHub PR, a build, or a successful CI job is an installed production OTA.

## Outstanding proof required before status can change from HOLD

1. All candidate PRs are not integrated or reverified as one source
2. Staging navigation feature checklist incomplete
3. Native Android IME GIF feature not proven OTA-only
4. Exact current installed live/staging OTA fingerprints missing
5. No final compiled RC against the complete candidate
6. No owner authorization to publish this candidate

**Machine-readable inventory:** `release/nov13-consolidated-ota-preparation.json`. **This branch modifies no app code, backend data, release workflow or installed app.**