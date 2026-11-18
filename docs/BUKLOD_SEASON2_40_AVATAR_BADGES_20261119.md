# Season 2 Circle Rank avatar art (DEV isolated — no production push)

Approved asset origin: user-owned Library folder \`Buklod rank badges\`, two sheets (Starter–Builder and Impact–BUKLOD Prime Elite).

* Exactly 40 ranks: 8 server rank families × V, IV, III, II, I.
* Original shapes are isolated on transparent alpha, not square screenshots. Each source sheet cell is disjoint.
* Packaged mobile atlas: 800 × 1280 WebP (5 columns × 8 rows, 160px cell). Atlas SHA-256: \`db2a7604e5657263336c8a358e0ef2d800cc6b6a3a7fc6b9c5a5a19174373887\`.
* Full-size individual 40 transparent PNG + contact sheet are in Library \`/Buklod rank badges/BUKLOD_Season2_40_Segmented_Avatar_Badges.zip\`.
* \`ProfileAvatar\` is the shared component for Wall, Connect, profile, comments and person lists. It resolves canonical member rank using ONE batched \`get_member_circle_ranks_v1\` RPC rather than guesses or N per-avatar calls. Explicit rank props can give immediate cached display.
* The visible badge is upper-left at 10 o'clock and pointer-events disabled. Outer ring changes color by server-verified family; no position shifts when rank changes.
* Online is cyan blue at 6 o'clock only when Supabase Realtime Presence confirms activity. App background, missing consent/session, disconnect, or errors must not claim a user is online. Presence is one global foreground-aware channel per account, not one subscription per avatar.
* Note/N overlay remains upper-right; clickable profile and chat targets remain unchanged, badge never intercepts taps.
* Rank art is presentation-only; Season 1 production rank arithmetic and economics are unchanged; Season 2 production embargo before Dec 6 remains in force.

### Release gates

Run \`node --experimental-strip-types --test tests/season2-avatar-badges-20261119.test.mjs\`, TypeScript, Expo Android bundle export, Wall/Connect avatar touch tests, rank progression tests, offline/reconnect, 3G, first-view AdMob fill and instant navigation. Validate on staging-user runtime 1.3.2 and compare production served manifest before/after any OTA. No production rollout authorized by this change.
