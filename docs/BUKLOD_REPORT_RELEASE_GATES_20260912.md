# BUKLOD Report release gates — 2026-09-12

## Canonical backend phase

- Live canonical domain status: `PHASE_4_SUBMISSION`.
- Canonical next phase: `PHASE_5_REVIEW`.
- The deployed `buklod-report-api-v1` currently contains a `review_report` action, but this is **not** sufficient to declare Phase 5 complete.
- Do not expose, advertise, or treat supervisor review/follow-up/reward writes as production-complete until the Phase 5 schema/RPCs, permissions, UI, audit behavior, regression QA, and live verification are explicitly completed.
- Existing Phase 4 submission, reminders, assignments, exports, scope isolation, and published-deadline behavior must remain stable.

## Web banner ads

The standalone Report web banner is intentionally isolated from reporting actions.

Rules:

1. Web only. Native `BuklodReportWebAdBanner.tsx` is a no-op; no AdMob/native dependency is added.
2. Dashboard only. The web route wrapper shows the banner only on top-level `/reports` with no scope or assignment selected.
3. Report forms, submission flows, supervisor management, consolidated review surfaces, login, privacy, and system/error pages remain ad-free.
4. No hard-coded publisher or ad-unit IDs in source. Production uses:
   - `EXPO_PUBLIC_REPORT_ADSENSE_ENABLED`
   - `EXPO_PUBLIC_REPORT_ADSENSE_CLIENT`
   - `EXPO_PUBLIC_REPORT_ADSENSE_SLOT`
5. Missing/invalid configuration means the banner renders nothing and makes no ad request.
6. Never substitute an AdMob mobile banner unit ID for the AdSense web ad-unit slot.
7. Production enablement requires the real web AdSense ad-unit slot and the applicable consent/privacy configuration before promotion.

## Release verification order

1. Source preflight.
2. Report-only TypeScript.
3. Static Expo web export.
4. Preview deploy.
5. Browser QA: login/account gate, top-level dashboard, scoped workspace, assignment form, reminders, submit, admin/report library, consolidated export, deep links, privacy/system states.
6. Ads-off preview verification.
7. Ads-on preview verification only after a real web AdSense client + slot are provisioned.
8. Production promotion only after preview QA passes.
9. Android/native remains a separate release path and must not be triggered automatically.

## Safety

- Do not merge or overwrite the dirty local Main working tree during Report release QA.
- Do not use GitHub Actions as a blocker while Actions automation/credits are unavailable.
- Do not create fake production deadlines, assignments, reminders, reviews, rewards, or member notification blasts during QA.
- STABILITY FIRST — ZERO REGRESSION.
