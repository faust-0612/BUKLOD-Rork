# BUKLOD Web · Restored scoped Connect + encouragement header (2026-11-07)

This source change supersedes the temporary compact Cluster/Organization Connect panel design in `BUKLOD_CLUSTER_CONNECT_COMPACT_R1_20261107.md`. The user requested the familiar single conversation room back.

## Exact UI behavior
- **Cluster / Organization Connect**: original authenticated `BuklodConnectThread(mode="scope")` rendered once inside the existing routed Main center column. No 340px Quick Chat, extra Expand/Collapse, route replacement, separate inbox, or fullscreen transition.
- **Write message**: on desktop web (width ≥1200px) *inside* `/scope` the composer bottom clearance is 8px instead of the extra 20px phone/system-nav allowance. Keyboard handling, mobile web, Android/iOS, and public/personal Connect retain their existing behavior.
- **Encouragement**: the public desktop header (including the wide scoped Main dashboard) displays a compact, existing daily-message component **before** notifications and profile avatar in the free right-hand area. Its duplicate center/content banner is suppressed only while the desktop shell owns the header; mobile remains unchanged.
- Existing account-bound notification counts, profile links, managed scope membership, cross-scope sidebar exit sequencing, notifications, messages and calls retain their original logic.

## Verification
Focused source checks: 15/15 passed on the DEV branch, including one room per scope, scope isolation, header ordering, removal of compact styles, and native/mobile composer fallback.
Updated existing tests that previously asserted the rejected 340px panel and added a header guard.

## Release boundary
DEV source only until main merge, frozen RC, successful web QA/build, and confirmed Expo Hosting deployment. Canonical BUKLOD Main target is `https://buklod.expo.app`, not the Vercel Classroom project. No Android OTA or backend mutation is part of this UI change.
