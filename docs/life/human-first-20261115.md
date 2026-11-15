# BUKLOD LIFE — Human-first completion (DEV, 2026-11-15)

## Purpose
Help people with real concerns in a gentle, useful tone before they voluntarily explore what Christian faith teaches about Jesus. The Community Wall stays a welcoming social product, not a sermon or religious dashboard. The Gospel is never disguised after the user opts in.

## Experience
1. LIFE home: six universal themes and twelve context-specific concerns. Practical support comes first.
2. Support: practical action, reflective question, a safety note. If personal Show Faith is ON, an optional and clearly labeled Christian perspective can be opened by deliberate consent.
3. Questions: ten curated, respectful responses with Bible references (authored paraphrases, no invented verse quotations).
4. Explore Jesus: six canonical sections with reference registry, three honest response options (respond, ask, not now), and optional follow-ups.
5. Help Someone: choose a person's concern, listen, ask permission, then select short/3-minute/full Gospel; do not record anyone else's response.
6. My Journey: user-initiated secure-device checkpoint only, under their own user ID. No remote status inferred from page views and no plaintext fallback.
7. Share: existing link/QR/share preserved; `life=1` registration routes an opted-in recipient to optional welcome after a confirmed session.
8. Life Impact: general invitation count and privately saved personal checkpoint only. No faith or conversion counters based on someone else's behavior.

## Privacy and migration
Source migration `20261115125000_buklod_life_no_inferred_milestones.sql` neutralizes legacy v1 remote stage writes and removes third-party spiritual milestone aggregation. New mobile code masks legacy fields even before migration. No existing user data is deleted. This migration is **NOT applied**, and old clients may still produce milestones until the backend is deployed. Release is blocked on isolated SQL/RLS regression and main/live reconciliation.

## No new native build
Uses existing `expo-secure-store`, React Native and Expo Router packages. Runtime 1.3.2 remains unchanged. No direct Drive/GIF/health/Saliksik/points/ads modifications.

## Mandatory acceptance
- 12 LIFE support concerns, 10 Gospel questions, 6 referenced Gospel steps
- Show Faith OFF: human-first support available; faith-specific routes guarded
- "Not Now" usable at every Gospel response without persuasion loop
- No inferred stage write, inviter notification, conversion points, third-party faith metadata
- Secure per-user checkpoint save/read/remove, graceful unsupported-device handling
- Referral code survives registration and LIFE welcome is optional
- Offline authored content, legible contrast and reasonable paddings at small Android viewport
- Staging Expo OTA exact-source readback and unchanged production; then separately assess production
- Device acceptance is NOT PASSED unless actually tested

**Release state: DEV source only. No OTA, live SQL, or production publication in this workstream.**
