# BUKLOD Home / Cluster / Profile UX R2 — DEV source only (NO OTA)

## Scope and canonical navigation

The source branch `feature/cluster-profile-home-ux-20261108` is based on the
previous `feature/interaction-auto-greetings-media-20261108` source integration.
The canonical bottom-nav Home is `/hub`; retired `/home` is not authoritative.
Profile is `/(tabs)/me`. Organization/Cluster Home is
`BuklodScopeHomeDashboard`.

### Cluster Home
- Move the complete existing `BuklodR2FocusMonitor` expandable drawer from
  the Points/Character screen into Cluster Home only (after first-view ads).
- Preserve existing real Points monitor RPCs, nomination form and ad
  opportunity. Do not insert this into Organization Home.
- Points guide now directs members to Cluster → Home.
- `/system/maintenance` is a separate global outage screen and is NOT a
  personal reward drawer. Its security and routing remain untouched.

### Profile / BSOC / Contact
- Remove duplicated Paid Features, BUKLOD Policy and Send Feedback profile
  shortcuts. Keep legal Privacy Policy and Notice. Surface Community Safety as
  a direct moderation-report route.
- Keep Live Support and Contact Us separate.
- Contact Us direct details: `mzbministry@gmail.com`,
  `09167366414`, Facebook Page: `Mt Zion Baptist Ministry`.
  A Facebook *search* link is used because the official permalink was not
  verified; do not invent or claim an official page URL.
- BSOC Live Support keeps its private case/attachment RLS. Put separate photo
  and video upload calls to action first; an upload can create a private case
  automatically. Show chat composer next; conversation/evidence and old case
  history lower. Keep private signed evidence links and 250-MB existing cap.
- Personnel authorization remains System Admin-only via existing
  `buklod_bsoc_issue_personnel_code_v1`. The admin copies a one-time, bound
  code and activation instructions, and sends them privately to the employee.
  The employee signs into their *own* BUKLOD account and redeems via
  `/bsoc/access`; backend `buklod_bsoc_redeem_personnel_code_v1` enforces
  account binding and existing training/production gates. Do not create a
  general Profile shortcut, bypass normal authentication, or publish codes.

### Sounds
- New Sound style selector: Classic, Gentle, Celebration; 3 volume presets
  Low, Balanced, High. These remap existing licensed bundled WAV cues rather
  than introduce remote tracks.
- Existing individual categories, cooldown, quiet hours, call suppression,
  notification platform semantics and preference storage remain available.
- Preview button works independently of an individual category toggle.

### Canonical Home
- Edge-to-edge Home layout with low-radius/square home cards; preserve
  first-view ads, Map, SOS, Smart Drawer and contribution.
- Two square standalone launch cards on both desktop and mobile:
  * My BUKLOD Home — miniature house layout, opens the existing
    `/personal-home` fully featured `BuklodBahayHome` app (real household,
    rooms, chores, garden, notes, family messages, bills, etc).
  * Health Center — opens existing gated `/profile/buklod-health` portal.
    **Known blocker:** current Health Focus App integration is
    `INTEGRATION_READY`, not a complete health application. This branch
    does not invent its features or claim it is complete.
- BUKLOD Today is weekly, not random AI daily: 12 curated cycle topics
  (love, relationships, family, mental/physical health, stress, sleep, life,
  friendship, boundaries, communication), readable intro, continuation,
  gentle suggested action, reaction and personal Dugtong, optional Share to
  Wall. General wellbeing information only, not medical diagnosis.

### Real BP for weekly engagement (source-only backend)
- Additive migration:
  `supabase/migrations/20261108050000_buklod_weekly_tips_r1.sql`
  (NOT APPLIED). Client must wait for authenticated/server-confirmed result.
- `get_buklod_weekly_tip_v1` shows the current Manila calendar week.
- `react_to_buklod_weekly_tip_v1` verifies active member, current tip,
  input and duplicate actions, serializes per user/week, writes bounded
  personal engagement and creates canonical pending BP ledger credit only
  after the first verified weekly reaction (+1 BP) and meaningful Dugtong
  (+2 BP); repeated clicks/edits get zero additional BP. Points remain
  *pending claim* under the existing reward workflow, not silently added to
  cash-equivalent balance. No client-side minting or points during VIEW.
- Private RLS (read own only), no frontend write privileges to interaction
  table, auth-protected RPC. Optional Share to Wall uses the existing
  composer, not another public-comment database.
- If the new backend RPC is not installed, Home tip reports unavailable,
  rather than inventing live BP.

## Verification and release hold

- 29/29 manually evaluated source/contract checks passed after changes.
  This is NOT proof of runtime behavior, TS compile, CI, isolated SQL test,
  authenticated media upload, or production end-to-end success.
- Added `tests/buklod-home-profile-support-20261108.test.mjs` (8 new
  contracts) and `supabase/tests/buklod_weekly_tips_r1.sql` (isolated DB QA).
- Before any release: run Node contract tests and TS check, run new SQL
  migration + SQL QA in isolated database, validate permission denials and
  idempotency on test users, photo/video upload and support chat, offline and
  weak-network fallback, sound previews, responsive mobile/desktop layout,
  actual module navigation and ad placements.
- Existing R1 greetings backend is already applied live; the preceding
  interaction R2 migration is still DEV-only. Do not replay R1.
- **No production DB migration, main merge, OTA, Expo web hosting update or
  Play/App binary publish has been made by this branch.** Release explicitly
  held. Distinguish source changes from live features.
