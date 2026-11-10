# BUKLOD November 10, 2026 — verified single-source production promotion

## Authorization and exact source
Owner request: reconcile active candidates, complete release gates, publish **one consolidated OTA**. Existing authoritative BUKLOD Main application source: commit `94d5c8101a995a06e610b8ae9c14ca5da83a48ad` (squash of verified PR #633 exact RC head `5bc842920a114a3ea9655e2f061ee8451fedcc4c`).

The ONLY source changes in this promotion PR are this documentation, its scope manifest and an independent contract test. The final protected-main promotion merge SHA (determined by GitHub at merge) is the sole checkout for all production workflows, not an earlier RC or staging branch. The user-authorized commit title MUST begin `BUKLOD_CONSOLIDATED_PROD_20261108` to dispatch the existing gated BUKLOD Production Android OTA and Production Web Deploy workflows from that same SHA. No manual EAS/Expo update outside these workflows.

## Cumulative RC evidence (exact PR #633 head)
- Engineering Accountability: run 42802264505 — success.
- Performance R1 QA: run 42802264504 — success.
- Main/Report integration QA: run 42802264507 — success.
- Unified Android and Expo Web compiled RC QA: run 42802264905 — success; Android export, web export, TypeScript and all focused checks passed without production publish.
- Latest GitHub main source `94d5c8101a995a06e610b8ae9c14ca5da83a48ad` contains the exact-scope BP Top 10, GCash funds, offline faith, AI-only Formation, faster photo/nav, Dugtong, Kingdom Home and Health door; the global Bible Quiz V4, Circle Rank and PTT work were already included and preserved.
- Supabase BUKLOD Connect migrations for BP Top10 and GCash reports applied; live read-only scoped SQL tests and AI-only Formation SQL regression passed. Finance payout settings remain unchanged.
- No changes to native dependencies, app.config.js, versionCode or Android package during consolidation.

## Mandatory live release fingerprint
Target Android package `org.mzbministry.buklod`; Expo project `23dad7d0-389a-406e-8dec-08965dab85d8`; runtime `1.3.2`; production channel.
Canonical `.github/workflows/production_android_ota.yml` must read actual latest live manifest ID/hash, check original V28 ABI constraints, verify AdMob env, compile Android production RC, freeze SHA256 manifest and archive RC, publish once, then independently verify the served update ID/runtime/bundle hash from Expo and archive `ota-evidence/verified.json`.
Canonical Expo web workflow may publish **the same SHA**; this is not a second app source. Both workflows must independently validate exact source and their own environment. No Play Store AAB build or new runtime.
**This release note is NOT proof that any OTA has been published.** Do not declare production success until the exact served update ID and hash are verified; failed gates must halt publication. Device acceptance was waived, not performed.
