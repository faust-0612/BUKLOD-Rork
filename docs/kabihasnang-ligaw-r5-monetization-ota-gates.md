# Kabihasnang Ligaw — monetization OTA readiness gates

Owner approved: free main chapters; ads only in library and after chapter, optional rewarded ad, optional later premium ad-free/art/licensed audio; no interrupting ads; no direct cash conversion for BUKLOD Points.

Implemented in DEV: `src/lib/kabihasnang-ligaw/monetizationPolicy.ts` fail-closed policy. **Not ad serving or billing integration.**

## Required before enabling ads
1. Verify the existing Android AdMob app ID and ad-unit ownership for the approved BUKLOD package, production app listing, policy/age classification, consent/privacy flows and no misleading rewarded mechanics.
2. Reuse existing BUKLOD ad provider; never introduce a second conflicting SDK. Add library banner, post-chapter interstitial with frequency cap, and explicitly opt-in rewarded ads. Do not display interstitial while a reader is inside the chapter or while PTT/DZAS is active.
3. Server-controlled enable/disable flag and analytics; handle no-fill, offline, poor network and consent denied without blocking story reading. Do not treat rewarded ad as chapter completion or duplicate BUKLOD Points.
4. Premium stays disabled until billing/store compliance, server entitlement checks, restore purchases, refund handling, and pricing approved by owner. Free core story must remain accessible.
5. Run tests and verify actual on-device ad requests with test ads before production ad IDs; validate privacy, navigation, no ad over reader, frequency caps, and fallback.
6. Verify R5 V28 cumulative baseline, story admin approvals, secure points, comments/replies, rights-cleared art/audio or approved waiver, cloud CI, frozen RC. Only then mark OTA READY and request gated production release.

## Release status
**BLOCKED / NOT OTA READY**. No real ads enabled, no premium purchase enabled, no production deployment. No claim of revenue.
