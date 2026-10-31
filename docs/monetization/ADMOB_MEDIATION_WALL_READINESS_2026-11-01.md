# BUKLOD Android — AdMob Mediation + Wall Revenue Readiness (2026-11-01)

**Status: DEV preparation only. No Mediation partner was activated, no APK/AAB was built, and no production OTA was published by this workstream.**

## 0. Reconcile what already exists (do not duplicate)

- PR #464 (merged): visible banner reservation before SDK mount; recovery from remount cooldown; no fast no-fill loops.
- PR #470 (merged): Android sponsored NativeMediaView in Public/Organization/Cluster Walls, the first row after approximately five posts, later six to nine posts; banner fallback; Home/Profile/Connect/Cluster inventory; stable ad frames, real SDK impression callbacks.
- PR #471 (merged): post-success, centrally guarded interstitial opportunities. This workstream **does not** increase its cadence.
- Existing SDK: `react-native-google-mobile-ads@16.3.4` and `expo-build-properties`; existing production package `org.mzbministry.buklod`. No third-party mediation adapter is currently configured in `app.config.js`.
- Current Environment: Android production runtime remains **1.3.2** for the established OTA workflow; JS app version and `versionCode` do not prove which OTA a phone is running.
- Observed ad telemetry is weak: prior Wall entry sample showed 450 app-side request events, 45 impression callbacks, 114 confirmed SDK no-fill failures. Later nine-session sample logged 35 requests and three impression callbacks. Do not misrepresent these small or unpaired counters as a matched fill-rate benchmark. Prefer the official AdMob reports for revenue.
- Existing app-side paid-event integration/revenue telemetry is separate from Google finalized reports. Never synthesize paid impressions or assume SDK request equals impression.

## 1. Mediation: dashboard-first, native-build-gated

1. Open **AdMob > Mediation > Bidding sources**. Inventory sources already available automatically in AdMob (no adapter or additional agreement) before evaluating third parties. For every candidate, verify format coverage (banner/native/interstitial/rewarded), Philippine traffic availability, payment terms, consent/privacy expectations and adapter requirement. Never assume a source is enabled merely because it is listed.
2. For third-party bidders, complete advertiser partnership/approval, required signal sharing consent, and ad-unit mappings **in AdMob**, using the real units already baked/configured for BUKLOD. No credentials or publisher secrets in GitHub. AdMob ad-unit configuration is **not** an Expo JS env toggle.
3. Create separate Android mediation groups by compatible ad format and targeting (start with PH and a small, reversible pilot). Retain AdMob Network participation, watch mediation-group priority/overlaps, and record source/mapping ownership. Changes in the dashboard can affect existing live app traffic: make a controlled pilot instead of an all-users launch.
4. **Hard build gate:** if a chosen partner requires an Android adapter or a privacy/consent SDK, evaluate the vendor's currently compatible Android adapter + Google Mobile Ads versions against `react-native-google-mobile-ads@16.3.4` and Expo 57; only then add a pinned native dependency via the existing `expo-build-properties` Android `dependencies` mechanism. A third-party adapter cannot arrive by OTA. Plan a distinct verified Android APK/AAB, native runtime migration, Play distribution and old-client cutoff before sending mediated partner demand to those installs.
5. If no new adapter is needed, configure eligible bidding/mediation demand through AdMob only after verification. Do not add placeholder adapter packages, unapproved SDKs, unused ad IDs, or invalid eCPM floor values to BUKLOD.
6. Use registered test devices, **Ad Inspector** and the adapter / waterfall / bidding diagnostics. Confirm consent, policy center status, app-ads.txt, real native vs banner format, provider callbacks, failure behavior, and Android runtime/build identity. No live traffic tests using synthetic clicks/impressions.
7. Back out mediation problems by removing the source from the pilot group or disabling the group at AdMob; preserve original ad units and AdMob demand. A binary-only adapter cannot be undone via OTA, so a new APK may be required if it breaks startup.

**No dashboard access/partner approvals in this workstream, so this phase is a release gate, not a claimed deployment.**

## 2. Wall monetization: fix missing behavior, not density again

- Keep PR #470 row cadence, sponsored native media frame, appropriate AD/Sponsored labels, consent gating, real callback telemetry, and existing banner fallback. No more blind insertion of ads into posts, chats, input controls, calls, Quiz/exams, or sensitive routes.
- Fixed in this branch: when native/online/safety eligibility becomes false, clear the destroyed SDK ad object and stale one-shot request/loaded state. A later eligible return re-enters the **existing** global cooldown before a new request; the SDK's stale object must never be rendered. No extra native requests or retries while offline.
- Preserve no-fill SDK handling (no per-frame rapid retry), native-ad timeout cleanup, original post/media rendering, stable placeholder/frame sizing (prevent scroll jumps), and platform-specific Android policy. Do not claim a video creative unless provided by the ad network.
- Verify Android Public Wall + Org Wall + Cluster Wall, including rapid scroll/recycle, 3G -> offline -> online, background -> foreground, lost/regranted consent and route safety lock, no Native unit (real banner fallback), SDK no-fill and repeated session entry. Also test existing photo/video scroll and chat compose to catch cross-feature regression.
- Existing `ads_all`, `ads_passive`, `ads_placements`, `ads_platform_android`, `ads_placement_<id>` controls allow rollback of slot eligibility. Confirm remote config application before relying on it in production.

## 3. Revenue experiment / ship gates

- Baseline per format and Android runtime over multiple complete days: **AdMob estimated earnings and impression-level revenue**; matched requests / matched requests, show rate, valid impressions, eCPM, gross ARPDAU, impressions/DAU, no-fill, time-to-first-visible-ad, crashes/ANRs and D1/D7 retention.
- Main KPI: incremental **ad earnings per DAU** at stable retention, not request counts. Segment new/returning, weak-signal, Public vs scoped Walls and PH vs other geography; do not compare two populations with different traffic mixes.
- Only raise paid impression opportunities when a measured 7–14-day pilot shows uplift with no material retention/performance/policy regression. Do not set aggressive eCPM floors until fill evidence supports them. Stop/roll back immediately on adverse fill, stability, consent or policy findings.
- Tests: `node --test tests/buklod-mediation-wall-lifecycle-readiness.test.mjs tests/buklod-wall-ad-stability.test.mjs tests/buklod-android-wall-ad-density.test.mjs tests/buklod-ad-request-gate-recovery.test.mjs` plus CI TypeScript/engineering/web-compatibility gates. Source-contract tests are **not** a device test.
- DEV -> verified frozen RC -> Android Production OTA (exact runtime 1.3.2 only if no native dependency changes). Verify device actually downloads the identified OTA and log verified AdMob creative + callbacks before reporting live. Adapter changes require new APK/AAB + compatible new runtime; **do not attempt to send them through the current OTA**.

Official references:
- https://support.google.com/admob/answer/13420272
- https://support.google.com/admob/answer/13407143
- https://support.google.com/admob/answer/13411971
- https://docs.page/invertase/react-native-google-ads/mediation
