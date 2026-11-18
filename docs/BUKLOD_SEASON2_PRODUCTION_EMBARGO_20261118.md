# BUKLOD Season 2 — Production-only embargo
Recorded 2026-11-18. Owner selected December 6, 2026 as earliest possible launch.

PRODUCTION: Until 2026-12-06 at 00:00 Asia/Manila (2026-12-05 16:00 UTC), no Season2 source package can be included in canonical Main Android OTA or Web production deploy. This applies even when Season2 flags are OFF.
After that date, the embargo remains effective until an exact Git SHA-bound, separately owner-approved record is created at .buklod/releases/season2-production-authorization.json. It must contain published schedule, Season1 signed results, official owner decision, verified Android staging RC, actual AdMob and navigation device evidence, and Character/finance reconciliation. No such record is created here.

STAGING: Season2 may be tested before December 6. Owner ordering: ONLY after the current nonseason Train A fix OTA has actually been promoted to and verified on production (served update ID, runtime, physical Android AdMob first-view/fill and instant navigation behavior). Merely green CI or staging preview is not enough.

INDEPENDENT FIXES: Non-Season2 repairs may still go to production before December 6, after existing DEV -> verified RC -> production release and safety gates. Never copy full outdated Season2 branches for routine fixes. Compare shared paths against latest production and selectively reconcile changes into separate Season2 DEV/staging branch with tests. If a fix contains Season2 runtime imports, remove/decouple them before production.

IMPLEMENTATION: scripts/buklod-season2-production-embargo.cjs scans canonical Season2 runtime files and import markers. Called before installs and immediately before publication in .github/workflows/production_android_ota.yml and .github/workflows/production_web_deploy.yml. The staging workflow files are not modified. No currency, Account Delete, app source or SQL altered.

LIMITATIONS: This is an automated GitHub production pipeline lock, not an Expo credential permission or GitHub merge-blocking rule. A direct Expo CLI token used outside these workflows could bypass the repository guard; configure production channel role restrictions separately. Lock only takes effect when merged to main. Legacy archived release workflows remain disabled.

BASELINES: canonical main d23cd882f7d34c4bca3a110dadd04ee4cb2240a9; current Train A source 6a33d05e85121d3d8a0a6760ef6b2e84c6c6721e staged but NOT verified live production; Season2 master #939 2cdf20f18e494ac8c47e902496d98e4f0ba64df5 DEV only.

NO OTA is initiated by this embargo. Do not start Season2 staging publication until the verified Train A production dependency is satisfied.
