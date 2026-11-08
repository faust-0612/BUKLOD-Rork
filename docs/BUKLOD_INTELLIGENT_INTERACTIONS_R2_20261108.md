# BUKLOD Living Interaction R2 — DEV implementation / NO OTA

## Product behavior

The public Wall has a **single compact living-update strip** immediately below
the first-view advertisement. It shows one real contextual item at a time,
with a next-item counter, optional expanded detail, and a working deep-link.
No giant static greeting poster, approval button, or fictional point/rank data.

Automatic birthday greetings are generated from the verified account birthday
in Manila time. **No admin approval or manual announcement** is required.
The account owner gets a private birthday notification automatically. Sharing
the birthday occasion with followers and Cluster members is a separate
member-controlled privacy permission, OFF by default; full birth date never
appears in community notices. Birthday privacy settings remain available
under Settings, but are not an approval step in the interaction strip.

Canonical audiences: BUKLOD Organizations, Clusters, followers, and the public
Wall for major announcements. Do not reintroduce legacy standalone churches,
`church_id`, a pastor approval gate, or a shadow achievement ledger.

## Implemented event triggers and suggested interaction

| Event | Real source | Audience/action | Example style |
|---|---|---|---|
| New member active | `buklod_scope_memberships` status ACTIVE | Active Organization/Cluster peers, followers; open member profile | "Welcome, [name]! Kasama na siya sa [Cluster]. Batiin natin." |
| Birthday | Verified `profiles.birth_date` + daily server job | Owner automatically; followers/Cluster only if owner opted into sharing | "Happy birthday, [name]! May pagbati ang BUKLOD." |
| KL chapter released | `kl_episodes`: approved AND release_at <= now | Community notification and KL reader | "Kabihasnang Ligaw — Series 1: Kabanata 6 available na!" |
| Circle rank unlocked | Non-baseline `buklod_rank_history` with real ledger ID | Owner, followers and active Cluster/Organization peers | "New rank unlocked: [rank]. Congrats!" |
| Character reward discovered | Actual `buklod_character_collectible_state.discovered_at` | Owner, followers and active Cluster/Organization peers | "[name] unlocked a new character badge!" |
| Philippine fixed holiday | Server holiday calendar, Manila date | Community; view updates | "Maligayang Araw ng Kalayaan — mula sa BUKLOD." |

Each category has multiple contextual copy options (vary deterministically by
day and context, never on scroll). Copy must name the real event and encourage
one clear action. Do not use "top player", "new character" or "achievement"
unless its specific state is independently confirmed. A character **reward**
is not the same as unlocking a new character. A rank increase is not proof of
being in the Top 10.

## Next event catalogue — NOT falsely marked live

After evidence-backed server events and contract tests exist, enable in phases:
(1) first public post; (2) first follower; (3) follower milestone; (4) first
approved community contribution; (5) profile completion; (6) first Cluster join;
(7) first Organization join; (8) Cluster anniversary; (9) Organization
anniversary; (10) first Bible quiz completion; (11) verified daily streak;
(12) verified 7-day streak; (13) mentoring session approved; (14) reading
series completed; (15) approved community service; (16) Kingdom achievement;
(17) new character genuinely unlocked; (18) character level advanced;
(19) first entry to Top 10 with leaderboard period specified; (20) first
place in weekly leaderboard; (21) new verified collectible set; (22) selected
important public anniversary; (23) follower/scope thank-you milestone;
(24) meaningful safe "continue where you left off" reminder.

No fabricated milestone: idempotent event key, verified source, scoped audience,
sensible expiry, easy opt-outs, notification de-duplication and an appropriate
action target are required before activating any new item.

## Media at publish

Music and animation choices are stored with the post; the reader does NOT
repeat the author's setup. On published Wall cards, **motion starts
automatically** only when the card is visible and the user has not requested
reduced motion. Off-screen motion stops without remounting the card/media.

One shared native music player **automatically starts only after a
music-bearing card remains visible for 700 ms**. It stops on off-screen
transition, navigation, or loss of audio focus; an explicit Pause suppresses
auto-restart for that post. No auto-start when the native video visibility
engine is active, the composer is open, or DZAS is playing. No one-player-per
post allocation, automatic background downloads, or unbounded retry loops.

**Web audio restriction:** browser-initiated audible playback is often blocked;
the track artwork/title and visual animation still appear automatically, and
the user can tap once to hear. Do not claim cross-browser audible autoplay.
Existing authored track choice is optional, and the video editor, ads, Share,
and published post records must remain unaffected.

## Bounded delivery and privacy

- Existing `queue_notification` handles member preferences and read/unread.
- Daily birthdays/holidays: 00:05 Asia/Manila; announced once per day.
- KL scheduled releases: check every 5 minutes, deduplicated by episode ID.
- Worker: 100 recipients at most per minute with transaction advisory lock.
- Published KL only, never drafts or scheduled future chapters.
- Actor-visible scoped achievements; no private birthdays without opt-in.
- No user-generated SQL calls to private triggers or job functions.
- Avoid repeated wall banner queries: one load when the Wall gains focus.

## Acceptance gates before any release

1. **Reconciled:** R1 `20261108025000_buklod_living_greetings_v1.sql`
   is ALREADY APPLIED live, with existing greetings tables/RPC/daily and
   per-minute dispatch cron. DO NOT reapply or edit R1. R2 is new additive
   `20261108025948_buklod_living_interactions_r2_20261108.sql` and APPLIED to production on 2026-11-08.
   Apply R2 only after isolated DB tests, schema verification and
   explicit release authorization.
2. SQL tests: active membership; cross-scope isolation; birthday self delivery
   without approval; birthday audience opt-out; real rank and collectible
   events; exact KL series/chapter and future schedule; idempotency.
3. UX tests: one-line default, expansion and next navigation, correct routes,
   no ad displacement, offline fallback, no invented achievements.
4. Media tests: visible/hidden motion without image/video remount; reduced
   motion; native auto music on one card, user Pause, rapid scroll, focus
   change, DZAS, video audio priority, web autoplay fallback.
5. Source/CI and targeted device tests, version and runtime compatibility
   gate, then separately authorize any promotion.

**Current authorization:** R2 database migration APPLIED and SQL-verified on 2026-11-08. App source is RC-only; no web deployment or production/staging OTA has been issued. Existing R1
birthday/holiday greetings backend and its jobs were already live before R2.
