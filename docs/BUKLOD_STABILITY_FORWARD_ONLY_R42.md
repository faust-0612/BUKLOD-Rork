# BUKLOD Stability Forward-Only Contract R42

This integration branch preserves completed BUKLOD work by rule:

1. Forward-port only. Do not broad-overwrite newer source with older branch snapshots.
2. One integration branch is the source of truth for local verification.
3. Character restore, IGPAT and Arena changes must coexist in the same branch before release.
4. Production is untouched until local TypeScript + web runtime verification passes.
5. Five Basic Characters must remain visible in Customize with approved Level 1–20 art.
6. Special Characters remain rank-gated and server-authoritative.
7. IGPAT active video must autoplay when visible and pause/unload when offscreen; browser autoplay restrictions fall back to muted autoplay rather than a dead player.
8. Arena must never render as an empty shell: it includes mode discovery, featured challenges, clear actions and safe offline/backend-not-installed states.
9. Buttons must have visible enabled/disabled/busy feedback and must not silently fail.
10. No unrelated file may be reverted to an older branch version.
11. MODERNIZE TO THE HIGHEST PRACTICAL QUALITY inside the feature currently being implemented or fixed: maximize visual polish, clarity, responsiveness, accessibility, perceived quality, interaction feedback, performance and reliability while preserving the product's established identity.
12. Modernization is additive and forward-only. Never remove, rename, replace, reset, downgrade, or alter unrelated working behavior merely to modernize another feature.
13. Preserve every newly verified implementation by default. Existing implemented behavior may be changed only when the user explicitly asks to change/fix it or when a demonstrated defect inside that same feature requires the smallest safe correction.
14. Newly added UI must be production-quality: no placeholder-looking empty cards, dead buttons, fake data, fake engagement, low-resolution assets, unexplained locked actions, or silent failures.
15. System Admin QA access may expose all relevant modes, characters, levels and test flows for inspection, but must not weaken normal-user server authorization or progression gates.
