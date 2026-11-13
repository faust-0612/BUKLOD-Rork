# BUKLOD Navigation 2.0 + Wall/Marites Stability — DEV integration candidate (November 13, 2026)

**NOT an immutable RC. NOT compiled Android staging. NOT staging or production OTA.**

## Exact source (immutable at candidate creation)

- Main baseline: `9f412afd71b74e41995a3a1a63e05e72f78b6e39`, whose newest change is only the separate signed staging APK mirror workflow fix.
- Navigation existing PR: [#783](https://github.com/faust-0612/BUKLOD-Rork/pull/783) `73c473caa4ebc139be4b231d3097760fe5c246e5`; 50 PR paths, of which 49 non-manifest blobs are copied byte-identically into this candidate.
- Stability existing PR: [#784](https://github.com/faust-0612/BUKLOD-Rork/pull/784) `dc85ce6ed7bc46a1f314885b6fb1d2739e38dcb2`; 5 PR paths, of which 4 non-manifest blobs are copied byte-identically.
- **No overlapping product paths**, no overwritten unrelated main files. One combined V2 engineering scope and one new focused cross-feature regression suite replace the two isolated PR manifests in this integrated DEV candidate. Exactly one inherited Navigation ads regression test reads the combined manifest instead of its standalone #783 scope (test-harness-only compatibility change); all product blobs stay exact.
- SALIKSIK authoritative [PR #780](https://github.com/faust-0612/BUKLOD-Rork/pull/780) remains a **separate, disabled** backend domain/release; no SQL/points migration included.

## What must be tested on this candidate before promotion

1. Engineering Accountability V2, protected-feature lock, 16 inherited changed Node focused tests + combined focused test, TypeScript, Expo integration export.
2. Do not assume source green is runtime. Build compiled Android RC from exact frozen commit, verify binary runtime `1.3.2` and installed staging APK/source mapping.
3. Actual signed baseline staging APK artifact [14016812505](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/43378875900/artifacts/14016812505) is from production-runtime source; **it is not the modernized RC**. Use only for source/feature parity, not as RC proof.
4. Confirm 21/21 canonical `docs/navigation-v2-completion.json` requirements by real evidence, staged security/backend permission tests, 100%→200% device font scaling, Gboard/Samsung GIF direct composer, five tabs and scope Back/deep links.
5. With same-build Infinix X6852: 30/60-minute fast scrolling, active/offscreen video + fullscreen Marites, native ads, image tiles, PTT/audio, screen pause/resume, memory/decoder/PSS/ANR exits. Record 15/30/60-minute per-build metrics; no 24h mixed-version averages.
6. Existing `scripts/navigation-v2-staging-gate.mjs --prepublish` requires legitimate fresh installed device evidence and all relevant requirements; manual staging Android-only OTA is approved only after the gate. After publication, verify exact installed update ID/source and `--release` gate. **Owner approval required before later web and production Android.**
7. If native IME `commitContent` is added, build a new staging-compatible APK before any JS OTA; do not claim OTA-only native support.

## Rollback/ownership

This branch is an immutable-source **candidate** only. No main merge, product backend writes, client install or paid build is performed by creating it. Keep the last verified production OTA and current installed staging baseline unchanged. If the native/performance delta causes regression, omit the 4 stability blobs and reevaluate root cause rather than changing the active video/AdMob engine. If Navigation scope changes in its original PR, refresh this DEV candidate from latest verified source and rerun CI on exact SHA. Never silently merge a stale PR or treat the draft candidate as a frozen passing RC.


## Nov13 staging consolidation continuation (unreleased)

- The existing merged live baseline retains the keyboard GIF `ACTION_SEND` return-to-original-composer repair from PR #778. **Native Android IME `commitContent` interception has not been established by this source-only change.** If the explicit in-place IME UX cannot be demonstrated in the existing signed APK, a new staging APK/native integration is required; no JS-only OTA claim.
- Add the exact reviewed Android comment action UI and test from [PR #786](https://github.com/faust-0612/BUKLOD-Rork/pull/786): owner/moderator Edit/Delete via existing permission-checked RPC, accessible More menu and retry feedback. No database changes.
- Add the exact read-only ADB staging APK equality verifier and tests from [PR #789](https://github.com/faust-0612/BUKLOD-Rork/pull/789). It checks *native APK bytes only* against the independently downloaded signed artifact. It **cannot** establish OTA update ID, preview backend safety or manual navigation/accessibility acceptance.
- New isolated `navigation-v2-staging-compile-qa.yml` compiles the Android bundle under staging identity only on this draft candidate; `navigation-v2-staging-ota.yml` additionally compiles Android and checks the integrated comment, APK, GIF, Wall/Marites and navigation tests **before** any optional manually approved staging publish. No production/web triggers were introduced.
- The 21-item checklist remains evidence-gated; never convert source CI into device acceptance. Before any staging OTA, verify current live/main source, installed signed staging build, EAS branch/runtime/channel, preview backend behavior, physical keyboard and 15/30/60-minute video/AdMob/scroll regression on Infinix. Preserve DEV→RC→staging-only; owner approval is a separate gate for web/production.
- **Current handoff: staging-only OTA SOURCE PREPARED, publication and installed RC unverified; production remains unchanged.**
