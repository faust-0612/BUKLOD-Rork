# BUKLOD Main — App-wide MAX-SAFE Advertising Lock (2026-11-11)

Status: DEV source and policy lock only; no new OTA, production AdMob impression or release claim.

## Target inventory
Preserve strongest practical ad coverage in Public Wall/Community, Marites, IGPAT/Reels, Hub/Home, Profile, Connect inbox, Organization and Cluster Home, Kingdom map/Hall/Treasury/interior/level results, Character studio, Circle Rank, Points/redeem/economy, Bible/Formation/KL reading completion, mentoring, verified creation/posting/submission and overage comments.

Android Wall default: first ad after 4 organic posts, then 4–6. Android Reels default: first sponsored page after 5 organic videos, then 5–7. Production EAS environment may override these; inspect live config before release.
Interstitial: at least two eligible completed actions between displays. No fixed eight-minute delay and no five-per-session quota. No ad after every button tap. Rewarded video is opt-in and cannot directly create BP, Shards, QMP or money.

## Non-negotiable policy boundaries
No full-screen ads inside PTT, live calls/chat, active video, SOS, form input, Health Center advice, payment/withdrawal, exams, critical admin, login/recovery or active gameplay. Passive ads must be labeled, viewable, away from navigation and action controls, and fail open on no-fill/offline.
Official AdMob rules: https://support.google.com/admob/answer/6201362 and https://support.google.com/admob/answer/6275345.

## Actual fix
Before: the passive banner carve-out for /personal-home/ptt and /personal-home/radio marked those routes nonsensitive to every ad format. After: those routes are globally sensitive, but keep their exact passive content banner IDs ptt_banner and dzas_radio_medium_rectangle; other ads remain blocked.
The /profile/buklod-health route is also sensitive with only the existing health_consultation_safe_info_banner informational placement. The Health Center page already mounts it only in a nonurgent screened state.

## Lock enforcement
The app-wide test verifies the live route guard behavior, consent/remote shutoff, cadence, high-traffic inventory, completion opportunities, viewability, test/live unit separation and all-screen audit. It is invoked on each Engineering Accountability PR, Unified RC Android/Web Compile QA and Production Android OTA pipeline. CODEOWNERS requests administrator review for monetization policy and release workflows.
Note: CODEOWNERS alone does NOT enforce protected branches. Repository owner must separately enable required code-owner reviews and status checks in GitHub branch protection/rulesets.

## Remaining acceptance
The static audit enumerates at least 300 source routes. Existing uncovered verified-success-break and passive candidate classifications are a review backlog, NOT authority to force ads into every screen or claim each action is monetized. Each eligible actual backend mutation must be checked before a completion hook is installed.
Consolidate any still-open PR candidates with the actual current main, run source/TypeScript/RC checks and verify production AdMob fill, EAS environment overrides, backend prerequisites and exact OTA artifact before declaring live. Owner's physical device-test waiver is NOT equivalent to verified device execution.

## Final app-wide source audit and safe expansion
- GitHub source tree inspection confirms 354 route TSX files. Structural-only scanning and read-only PR CI enumeration cover every route; 300+ route count is not the same as fully verified on-device ad fill.
- Community Discovery receives an above-fold viewable native-first AdMob unit with banner fallback; Organization Setup receives an after-actions native-first information sponsor. Both inherit existing consent, test/live ID separation, remote controls, viewport gates and no-fill collapse.
- Dedicated protection now covers personal/group conversations (including MZB), quiz sessions, prayer drafting, payment/withdrawal, attendance/admin/finance and settings operations. The existing successful completion exceptions in Kingdom and IGPAT remain narrow and unchanged.
- Engineering ruleset BUKLOD Engineering Protection is active with objective-scope-gate required, but code-owner review flag is currently false. Admin-level change is required to enforce CODEOWNERS; GitHub plugin does not have write access to rulesets.
- Every PR, unified RC, and production OTA invokes both focused contract suites and app route summary. Target proof is successful exact-head CI and preserved independent consolidated release gates.
