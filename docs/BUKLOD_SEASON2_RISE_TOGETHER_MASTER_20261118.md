# BUKLOD Season 2 — Rise Together / Ang Panibagong Yugto
## Integrated premium social game design, consolidation baseline and DEV-to-production runbook

**Owner-selected opening target:** Sunday, 2026-12-06, Asia/Manila.  
**Design duration:** 12 editorial weeks in four 3-week acts. Proposed end date is **NOT PUBLISHED** and must not be inferred from this content roadmap.  
**Status:** DEV integration / blocked production gates. **No backend Season2 row, live quest, live token, notification push, new reward, or production OTA is authorized by this document.**

### 1. Product north star

Make BUKLOD a genuinely enjoyable **social + narrative + learning + Character world**, rather than a mandatory daily points chore. A member should return because friends responded, a chapter revealed a clue, a Character acquired a verified collectible, a team made meaningful progress, and the community feels alive. A seasonal leaderboard creates fresh competition for newcomers without confiscating lifetime progress. A player may browse and participate in core social features without joining any season.

Choose **Rise Together (Ang Panibagong Yugto)** as the editorial theme. The story involves a beacon that links the 13 Character paths to real-world community, creator, learning and Kingdom areas; no implied judgment of religious faith or personal worth. The canonical Character World has 13 IDs, 20 stages and 5 asset slots per stage (=1,300 **catalog** artworks, not 1,300 owned items). Character V3 per-character points stay BP-derived; no second Character XP authority.

### 2. First-session journey

**New or returning member (sub-3-minute experience target):**
1. Home shows a compact, calm Season badge/teaser. Tap to open a Season Hub; never block normal Home/Wall/Connect loading or AdMob.
2. Choose **Explorer**, **Creator**, or **Together** as a voluntary path. No auto-enrollment, no coercive faith choices. Choice can be changed between quests; already earned receipts remain stable.
3. Meet one of 13 **Story Guides**. Preview the user's already selected Character in future verified integration; do not silently switch or reset their character.
4. Open the first publicly published story scene. During preparation only, show a labeled teaser. No false video, loot box or counterfeit locked award.
5. Pick an optional available mission. A server-acknowledged source event yields a clear receipt, such as "meaningful reply verified"; a pending offline comment is shown pending and never paid twice.
6. See where the verified accomplishment counts: existing BP and Character-level progress, monthly QMP if independently qualified, separate season score, future Journey Token if launched, and optionally a real earned collectible.
7. User can dismiss/opt out of the Season at any time; Wall, Connect, Bible, learning and safety remain fully usable.

**Daily, weekly, season cadence**:
- Daily: choose from 2–3 diverse genuine activities; optional short reading, a useful reply, a story, original creation, Kingdom practice, or team contribution. First qualified action is rewarded at most once per source key. A raw view, generic reaction storm, trivial comment or mass repost is NOT a qualifying Season mission.
- Weekly: one new act scene, a Player Guide cameo, progress of personal/team story quests, optional catch-up without double rewards, a small visual trophy reveal.
- Every three weeks: act narrative finale, Story Gallery and additional earned-item preview.
- Season close: reconciled, immutable rankings, opt-in celebration, verified awards and historical museum. Permanent BP, Character levels, badges, inventory and cash never reset.

### 3. Story content production — 12 editorial weeks (concept only)

| Week | Act | Chapter | Main interactive beat | Alternative accessibility route |
|---|---|---|---|---|
| 1 | The Call | The First Signal | Meet 13 Guides, choose an optional path | Free orientation |
| 2 | The Call | The Story Door | Verified Today/Dugtong or KL exploration | Read the free scene |
| 3 | The Call | The First Ally | Distinct meaningful comment / first dialogue | Solo Story path |
| 4 | The Makers | Maker Square | Original helpful Wall post | Equivalent learning or supportive participation |
| 5 | The Makers | Stories in Motion | Creator video scene and media safety | Text, image or reading—never require video |
| 6 | The Makers | The Shared Page | Build a respectful story exchange | Private solo scene without disclosure |
| 7 | The Alliance | Bridge Builders | Formation or parallel general-learning achievement | Verified non-Show-Faith route required before activation |
| 8 | The Alliance | The Kingdom Trial | First server-verified skill milestone | Free practice if backend mastery receipt unavailable |
| 9 | The Alliance | Together We Rise | Co-op with distinct individual verified contributions | Solo equivalent for members without team |
| 10 | The Legacy | The Memory Gallery | Display genuinely owned Character items | View catalog/history with no grant |
| 11 | The Legacy | The Last Clue | Bounded catch-up with unused legitimate source | Free replay with no second reward |
| 12 | The Legacy | Constellation Finale | Final verified achievements and story ending | Noncompetitive free finale |

**13 guides**: Phan (Builder), Quin (Pathfinder), Van (Guide), Christian (Guardian), Lhen (Story Keeper), Ace (Inventor), ELESUR (Navigator), Jawo (Connector), Mitch (Artist), Niel (Strategist), Angel (Steward), Vhen (Cultivator), Trudice (Explorer). Each guide has a distinct short narrative line in the typed campaign module; no new Character selection state is stored by these previews.

**Actual game assets still needed**: approved four act scene visuals, original event dialogue, future optional ambient SFX, 13 responsive guide appearances, 3 visual mission boards, verified ownership icons, 4 reward concept art, finale and interstitial scenes. Reuse existing validated 1,300 WebP catalog and local assets when possible. Do not treat asset existence as authority to grant items. Avoid first-paint Rive/heavy 3D; use lazily loaded visual layers, reduce-motion support and 3G degradation. None of these assets is falsely marked delivered here.

### 4. Premium social play — meaningful, not spam

**Explorer**: KL verified reading, Today/Dugtong actual accepted submissions, meaningful accessible Main learning, Kingdom storyline. Faith scope-specific Bible/formation optional routes only when show_faith_content is true and the user is authorized. No prayer-sincerity score.

**Creator**: original Wall post, meaningful comment and original qualified video. Reuse verified existing QMP source rules (5 QMP useful post; 10 QMP qualified video; 3 QMP meaningful reply) with anti-self, duplicate, content quality, cooldown, hourly caps. This must NOT add second QMP on Season quest completion. Video fair rotation and first-frame loading from consolidated #930 help creator discovery.

**Together**: cooperative goal requires unique participants and verified independent source receipts; do not reward referral rings, self-reactions, spam invites or false attendance. Solo progress track is always available. Teams cannot force religious activity or access private reflections.

**Social features that increase genuine returns**: friendly ongoing creator threads, friend response highlights, saved episode collections, consensual team Story boards, weekly creator spotlights based on quality and moderation, small replayable Kingdom games and opt-in nostalgic Gallery. Not every activity needs coins; social acknowledgement and real conversations are the strongest sustainable loop.

### 5. Currency and economy separation — a single event, several independent justified outcomes

| System | Owner | Award / reset model | Not allowed |
|---|---|---|---|
| BP / Circle Rank | Existing public points ledger | Verified permanent lifetime progress, character-linked V3 | Generic idle deduction, duplicate claims, client minted BP |
| Character level | Existing per-character V3 BP-derived state | Persist independently for all 13 Characters | Reset on switch, new XP authority |
| Monthly QMP | Existing private Community qualification/finance weight | Qualified monthly participation only; existing 30% AdMob user-pool logic | Season bonus generating QMP or peso credits |
| Season Momentum | New optional distinct seasonal score, **OFF** | Capped verified daily activity + voluntary mission consequences | BP/QMP/cash/owned item confiscation |
| Journey Token | Proposed Character-owned noncash ledger, **OFF** | Server-minted spendable optional cosmetics only | Cash exchange, lootbox, required messaging/Bible access |
| Badges / collectibles | Character server receipts & canonical inventory | Verified, permanent accomplishments; seasonal badges only after published close | Guessing ownership from 1,300 files |
| Kingdom Shards | Existing Kingdom-only ledger | Game-only mastery/crafting rules | Converting into QMP/pesos/app-wide tokens |
| AdMob member revenue | Existing financial V3 | Based on verified revenue, independent QMP period and settlement gates | Using raw Season Momentum for payout, false "real-time" estimates |

**Balance design**: the prior disabled R1 preview proposes +5 Momentum for a verified active day and up to -9 daily (post-grace inactivity plus opted-in reading and creator commitments). A stronger candidate +10/day and -15/day cap was discussed but is **NOT** the committed policy and requires modeled reward distribution and explicit versioned approval before any live migration. The displayed Season may show proposed Momentum only after a real authoritative backend ledger exists. Never deduct permanent earned BP, rank, badges, Character items or financial rights simply because someone stops playing.

**No account deletion** for zero seasonal score; show optional Recovery Mode. Automatic deletion of a user account based on game scores is prohibited. Existing explicit Profile > Delete Account is separate.

**Anti-farming and offline**: immutable source receipt based on user+scope+verified event+period+reward_type; unique DB constraint, idempotent server RPC, request-key replay and serialized wallet spending. Offline queue may show optimistic UI pending but cannot mint rewards or record a missed commitment until the day is truly settled. A failed network must never be interpreted as a violation, lack of formation or spam. Legitimate original receipts remain auditable.

### 6. Notice and preparation program — Manila date and opt-in

**Target opening (owner supplied): Sunday Dec 6, 2026**. Official end date unconfirmed. These are candidate user communications, not a claim that live push is configured:
- Nov 22: Season reveal, title and spoiler-safe visual teaser. "A new BUKLOD adventure is being prepared."
- Nov 29: Optional Explorer/Creator/Together path preview; no auto-enrollment.
- Dec 3: Clear rules and honest reminders: voluntary activity, penalties only inside future seasonal Momentum, privacy, opt-out, weak-network protection.
- Dec 5: Single opt-in reminder, targeted to verified future published schedule.
- Dec 6: Opening ceremony only AFTER atomic live Season publication and client verification. First chapter must actually exist before "Chapter 1 unlocked".
- Later: weekly chapter notices only after server-signed publication receipts; one opt-in season digest instead of daily push storms. A dedicated three/five-state notice receipt prevents replay across devices.
- Closing: announce "Results being verified" and only later winner/award receipt after immutable finalization; do not imply cash payout.

**Quiet hours and limits**: generic in-app first; opt-in pushes only when permitted; max suggested 2 marketing pushes per 7 days, and 1 per scheduled phase (needs user preference engine approval). No faith activity, prayer, minor, medical, sensitive attendance or private message details in push. Exact event/season identity and account ownership must be verified server-side; no client local clock as a payout trigger. User may mute Season notices while keeping safety notices.

### 7. Lifecycle, historical data and fairness

**Existing production Season 1** (verified 2026-11-18): 2026-08-01..2026-10-31, status ACTIVE despite expiry, zero finalized season results, 869 claimed/legacy credits and 609 pending credit entries in that calendar window across 326 user accounts. These counts are not 326 qualified winners and not automatic grants. public.get_my_buklod_rank_dashboard selects status ACTIVE without expiry check, so existing UI may mislabel stale Season; the read-only new UI guards that display.

**Backend Season V2 contract**: PLANNED -> PREPARING -> LIVE -> CLOSING -> FINALIZED -> ARCHIVED. Only one LIVE row; locked backend transition and versioned rules; require admin authorize publication; cannot finalize with outstanding eligible events not reconciled; handle pending offline submissions, Manila timezone, distinct source/claim timestamps, moderator reversals and official-account exclusion; snapshots must be idempotent, immutable after published adjudication and appealable. No automatic live Season 2 insert in this candidate.

**Proposed 12-week editorial calendar is NOT the official season length**; Dec 6 is a target and no end is written to existing tables. Year-boundary and January monthly QMP settlement must remain correct, separate from Season calendar.

### 8. User-facing layouts

**Home**: compact Season Hero (small icon, next teaser, one tap), no extra bar or huge empty spacing; text-first on poor signal. Season hero must never steal Home's first-view AdMob slot.

**Points/Circle Rank**: already implemented read-only Season Journey card is collapsed by default, uses existing rank response, shows expired Season1 honestly, owner Dec 6 target and teaser milestone dates. In this candidate it adds an original story intro, carousel-like 13 guide switcher, four actual narrative act previews, optional expandable 12-week roadmap and four locked reward previews. All selections are local only; no database enrollment or fabrication.

**Profile/Character**: eventually show overall rank, monthly QMP badge (not earnings), selected Character's server level, owned verified Season collectibles, and separately optional Season score. Locked profile still renders avatar; no leakage of private achievements without consent.

**Wall and video**: preserved consolidated video handoff, swipe, fair discovery, post detail counts, meaningful reply algorithm, content-first spacing, actual recent comment. Queued comments remain pending until v5 idempotent backend is deployed.

**Connect**: fast tab return and stable scroll, clear delivery pending indicators; no mandatory seasonal messages or intrusive gamification. PTT/calls protected.

**Kingdom**: add Character Guide entry and skill-based optional missions only after verified first-win receipts; preserve game-only Shards and separate player level. Existing PR #879 library item art is independent; cannot grant from static artwork.

**Notifications**: opt-in Season category, single feed entry per phase, account-scoped delivery logs, immutable event deep-links, push quiet hours, muted preference retained across devices.

### 9. Source integration decision — as inspected Nov 18

| PR / work | Decision for integrated Season 2 DEV candidate | Gate before production |
|---|---|---|
| #930 existing main consolidated Android 1.3.2 source | BASE: retain video player, swipe/fairness, scoped video, lazy persistent Android dashboard, weak-signal login, Henry recoveries | Exact installed runtime/channel, AdMob fill/navigation/performance and RC |
| #933 individual reaction count | INCLUDE source & focused tests: isolated post/reaction UI, no DB change | Post detail + Wall reaction parity, Android/web smoke |
| #925 Main Bible V4 rubric client | INCLUDE only safe client UI and focused contract: live five migrations already confirmed, but migration files remain in separate PR | Staging backend schema parity, authentic learner attempt/no-manual-review, client fallback, scope |
| #937 Character/Momentum token preview | INCLUDE pure policy/tests, all currency/deduction switches OFF | Receipt/RLS/ledger, fairness, gameplay signoff |
| #938 Season Journey read-only UI | INCLUDE UI/tests + upgraded editorial content | No extra Points RPC/first-view ad regression |
| #935 offline comments + BSOC low-signal | **HOLD** because Wall UI/Auth overlaps #930 and v5/BSOC migrations are not staging-verified | Semantic merge + SQL migration/RLS + offline/reconnect real E2E |
| #932 Attendance V2 rotating QR | **HOLD** because server tables/RPC absent from live and no verified staging backend | Staging schema, QR expiry/replay, reward creator separation, server caps and E2E |
| #931 daily QMP/AdMob reporting | **HOLD** Google OAuth invalid_grant in official importer; cron disabled; no new provider report | Google reauthorization, actual fresh daily PHP receipts and finance QA; preserve 30% pool |
| #879/881/896 Character assets and all-13 game | **HOLD** asset ownership/runtime and actual Android artwork/zoom have not passed full consolidated RC | Inventory and Character V3 server receipt reconciliation, asset memory, visual device QA |
| #890 referral +10/+10 | **DO NOT retrogress** owner-approved referrer +20 conditional policy; reconcile backend before including | Qualified rank-up rule, one-time ledger and no payout coupling |
| Other older open UI/spacing PRs | COMPARE to main and #930; forward-port only still-missing targeted deltas | No duplicate/stale whole-branch merges |

**Important**: Current PR #930 is an RC source branch, not evidence of a staging or production OTA. No user-facing new Season entitlement is enabled by adding policy files. Do not confuse release candidate source, CI and actual installed production.

### 10. Release trains — responsive fixes without sacrificing safety

**Train A: Consolidated repair OTA (as soon as verified, not artificially delayed until Dec 6).** Base main + reviewed RC #930 + compatible read-only and UI patches from this candidate. Verify exact source/head, all focused tests, Android/Hermes/runtime 1.3.2 eligibility, AdMob first-view and consent/fill, stop offscreen videos, instant nav p95, Connect scroll, offline auth, post reactions and Bible feedback. Produce exact artifact/manifest/served update ID, staging first. Only then production promotion. No forced new database migration.

**Train B: Season2 content / notice activation.** After Season1 historical result reconstruction, approved published Season2 dates/end, server quest receipts, canonical Character inventory and badges, grace/season score, visible all-scope parity and notice delivery preferences/receipts. Launch one server-signed chapter at a time; allow rollback to prior view without forfeiting owned rewards.

**Train C: Optional advanced gameplay.** 13 Character scenes, item customization, cooperative quests, Kingdom challenge gates, 12-week story content, art/SFX and polish. Not a pretext to block tested repair OTA. Can be disabled if native/runtime/size budget fails.

### 11. Acceptance and observable success

- **P0 safe release**: no loss/duplication of BP, QMP, bank ledger, withdrawn cash, Character levels/items, attendance, prayers or profile privacy; stable provider ads, first-view load/fill and near-instant tab; existing end-to-end Wall/Connect/Kingdom UI behavior retained.
- **P0 Season1**: 609 historical pending credits reconciled individually with audit; signed final results from 326-account population after exclusions; no phantom leaderboards; cloned idempotent close safe under two simultaneous attempts.
- **P1 gameplay**: 13 guide entries and 12 chapters preview; 3 tracks always usable without faith coercion; realistic visible story assets, feedback, opt-out, reduced motion; no mislabeled preview as live.
- **P1 notices**: per-account stage idempotency, timezone & quiet-hours, delivery receipts, offline absence, no false award or account deletion.
- **P1 credits**: real event receipt and only one grant per source; token and Momentum separate from BP and QMP; zero Momentum recovers, never deletes.
- **P1 finances**: 30% user pool remains preserved, actual Google provider report freshness and financial settlement controls independently tested.
- **Performance**: keep render-first text on weak network, no new RPC on Points tab, no offscreen media or ad stacking, fail-closed and bounded retries. Measure on Android device; a JS typecheck is not a performance benchmark.
- **Release evidence**: exact DEV/CI/RC/production SHA, runtime, channel, EAS update group and installed-client parity, verified backend migration history; strict DEV->verified RC->production OTA.

### 12. Current completion boundary

This repository candidate delivers **integrated source + a playable-in-place preview UI with local story choice/guide/roadmap exploration**, content rules and behavioral tests; it does **NOT** deliver a live world game, Season2 activation, new token currency, actual Momentum debits, operational notifications, source-backed inventory grants, Android production OTA, or real-money revenue sync. Missing dependencies remain explicit blockers; no background release work is implied.

**Owner decision still needed only for consequential publication details**: final Season2 closing date/duration, production activation of exact season reward/penalty rates, and provider OAuth credential reauthorization. Routine DEV/QA work can continue independently.
