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
