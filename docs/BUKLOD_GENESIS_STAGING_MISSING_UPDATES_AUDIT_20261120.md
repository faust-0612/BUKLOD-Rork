# Genesis 2.0.0 staging — missing-update reconciliation (November 20, 2026)

## Evidence and baseline
- Installed signed staging APK: EAS d9e279a6-766b-4bd9-8316-3f700749594c, source 5bd80dbc, version 2.0.0 / code 11, Genesis preview runtime/channel, separate production package.
- This source patch begins at DEV 130b2f273ed92a6e1a200e1a3b8a7db4cade7095, not production main.
- Original reviewed implementation: staging PR #963, source 42779df (merged into old staging integration branch; not included in Genesis APK).

## Verified missing from signed Genesis source
1. Profile/Wall/Connect/comments avatar decoration: shared ProfileAvatar had no Circle Rank emblem, colored ring, or server-confirmed blue online indicator. Current Profile displayed only rank TEXT. Corrected in DEV: 40 approved art cells, 10-o'clock overlay, rank-colored frame, canonical batched read-only RPC, no guessed rank.
2. Avatar pressables clipped outside-emblem artwork (overflow hidden): corrected in DEV for native and web; existing hit-test/profile/Connect tap semantics retained.
3. Notes N remained at bottom-right, conflicting with the 6-o'clock space. Corrected upper-right for Genesis preview only, with legacy layout preserved elsewhere.
4. 2-o'clock Weekly Performance icon is separate draft #965. No verified live Main staging functions, so DO NOT activate or present fabricated class/score; not included in this patch.
5. 6-o'clock blue online dot is implemented but held behind explicit backend approval: it must not create a new ephemeral track channel in the owner-authorized live Main backend. Unknown/offline means no indicator.
6. Owner also reported an obsolete thorns/black startup and noncinematic green-B visual after installing APK. Separate cinematic startup reconciliation must be verified independently; source compilation alone is insufficient.

## QA and release boundary
This is DEV source only. New React Native JS/TS plus already-bundled artwork can be delivered later by a verified OTA on exact `2.0.0-genesis-preview` runtime/channel; no new APK required for the rank visual itself. No OTA published, no AAB, no production update, no live reward grants. Continue full missing-features comparison against pending staging PRs; don't silently merge unreviewed branches. Verify artifact SHA and real Android rendering before acceptance.
