# BUKLOD visual transformation — staging source candidate

**BLOCKED BEFORE RELEASE.** This is implementation work, not an accepted redesign or an OTA receipt.

The exact upstream integration baseline is `6b0f7e3167867bb746e34da4637430f131b588bb`. Main was independently read as `9f412afd71b74e41995a3a1a63e05e72f78b6e39`. Historical publisher-side production identity in upstream documentation was not independently re-attested here. Upstream PR #790 and all of its changes are retained; this stacked change targets its DEV branch, never main.

## Implemented source changes

- **Home:** New responsive everyday essentials grid on actual /hub, compact contribution disclosure, retained ads/tools.
- **Profile:** Editable 72dp avatar and identity in a compact row, rounded cover shell, distinct Settings/More.
- **Cluster:** Wrapping category navigation, readable membership metadata, touch-safe directory actions.
- **Wall:** Secondary Life/story highlights disclosure, consistent post surface and scalable composer/reaction controls.
- **Marites:** 132×178 horizontal story rail; bounded list, media priority and fullscreen paths retained.
- **Connect:** Compact themed messaging masthead, light contacts rail, semantic-theme conversation rows and tabs.
- **Settings:** Searchable grouped settings, theme entry, icon tiles and retained account/security destinations.
- **Drawer:** Compact green header, larger category targets, retained private file/note operations.

Existing RPCs, auth providers, AdMob provider, native video implementation, comment ownership/GIF fallback, Connect composer, persistent navigation, app config, EAS config and dependency manifests remain byte-identical to the integration baseline. That is source-preservation evidence, not proof of runtime correctness. No IGPAT entry is added.

## Acceptance matrix

Completion is **0/8 areas (0%) under the requested acceptance contract**, despite source changes in all eight areas. No actual AFTER screenshot has been captured and no screen is marked visually passed.

| Screen | Implementation complete | Actual screenshot | Visual acceptance | Functional regression | Remaining work |
|---|---|---|---|---|---|
| Home | Candidate only | No | Not verified | Source only | Actual render + interaction acceptance |
| Profile | Candidate only | No | Not verified | Source only | Actual render + interaction acceptance |
| Cluster | Candidate only | No | Not verified | Source only | Actual render + interaction acceptance |
| Wall | Candidate only | No | Not verified | Source only | Actual render + interaction acceptance |
| Marites | Candidate only | No | Not verified | Source only | Actual render + interaction acceptance |
| Connect | Candidate only | No | Not verified | Source only | Actual render + interaction acceptance |
| Settings | Candidate only | No | Not verified | Source only | Actual render + interaction acceptance |
| Drawer | Candidate only | No | Not verified | Source only | Actual render + interaction acceptance |

## References

BEFORE: supplied screenshots `1000093478(1).jpg` (Profile), `1000093479(1).jpg` (Home), `1000093480(1).jpg` (Cluster), `1000093481(1).jpg` (Wall), `1000093482(1).jpg` (Connect), `1000093487(1).jpg` (Settings).

Direction: supplied `BUKLOD Navigation 2.0 Preview.png`, combined with the current green-B compact social UI requirements. It is a design reference, never an AFTER image.

AFTER links: **none**. Browser/export output is not a screenshot, and no mockup is substituted.

## Validation and release hold

- Focused tests: 83/83 passed (navigation, responsive columns, preserved destinations, media/comment contracts, Cluster, QMP and byte-identical protected implementations).
- TypeScript: validation executed; final result in machine-readable evidence.
- Android Hermes JavaScript export executed with two workers. A first concurrent attempt was killed (137); a bounded standalone retry passed. Final source export receipt is recorded in the JSON evidence. This is not a native APK build or emulator test.
- Web export succeeded locally; no web deployment was performed.
- Resolved config: package `org.mzbministry.buklod.staging`, channel `staging-user`, runtime `1.3.2`, EAS environment `preview`.
- Physical Infinix verification: **SKIPPED BY OWNER**, never passed.
- Actual native rendering: **BLOCKED**. No adb/emulator is installed. Local Chromium is denied its singleton socket (`EPERM`). The separate browser cannot connect to the local server (`ERR_CONNECTION_REFUSED`).
- No local authenticated preview app session or Expo release credential was supplied. Signed APK parity and live preview backend behavior are not independently established.
- **No OTA publication, no native build, no production, no main merge and no web release.** Existing strict release workflows are untouched. Do not publish this source candidate before real rendering, comparison/correction, role-sensitive regression testing, signed binary/runtime parity and exact-source release checks.

## Continuation

Use this exact DEV source in an Android-capable test environment, render all eight areas at narrow/large screen sizes and enlarged fonts, exercise keyboard, media, ads, account/role boundaries, offline/retry and navigation. Correct mismatches, freeze the tested SHA as RC, confirm the existing signed staging APK/runtime and preview isolation, then publish one Android-only staging-user OTA and independently read its exact EAS receipt and served manifest. Keep production/main/web untouched.
