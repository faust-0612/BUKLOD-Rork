# BUKLOD Genesis Season 2 — Owner-approved conso audit (21 Nov 2026)

**Scope:** One BUKLOD Main app, existing paid Supabase `yhanxndaqbmuzbdqlblu` and existing EAS `season2-genesis-preview` staging channel. Never create another staging project/subscription, install another Arena app, or mutate production.

## 1. Corrected approved first-view

- The *actual user-approved* landscape 1672×941 map is now bundled **byte-for-byte**, not copied from the older, label-incompatible 1448×1086 Welcome Valley illustration. Its SHA-256 is `a343c70d1c71e849b536570bd92ede7134667d40347f6465003d41710e818b02`, original bytes 473226. Deterministic 4-part user-source handoff and GitHub DEV-only decoder/workflow preserve provenance.
- Main Genesis first-view `/buklod-map` and Genesis Home now display the same approved map, with locally packaged art and no extra persistent bottom bar. Existing first-view AdMob, audio focus and auth/consent/forced-update gates remain.
- Twelve labeled scene signs are ONE-TAP destinations, not a selection plus scrolling down to ENTER. Character Kingdom `/games` and Empire Arena `/games/empire-arena` are separate. Community Village `/community-village` opens its own nature-first submap. Other signs lead to actual guarded Community Hall, Connect, Marketplace, Bayanihan, Personal Home, Focus Apps, Achievement, Life and Knowledge routes.
- Four baked corner icons (menu/profile/notifications/search) are covered by real accessible click targets. The moving Phan concierge is **outside** the map image, greets and provides small assisted links, respects reduced motion, and does not add an unauthorised audio/AI backend.
- `showFaith` OFF remains valid. The Life Center sign opens general Learning as a safe path instead of restricting Character progression or showing faith-only content.

## 2. Premium Kingdom / Arena separation

- Character Kingdom remains the canonical existing `/games` experience with original 13 identities, nature-first Kingdom background, collectibles and character authority.
- Empire Arena is a **screen within BUKLOD Main** (not another APK), with three local battlefields, 52 fullbody original WebP pose clips (13 × idle/walk/attack/skill), source-owned audio and landscape controls, a local offline practice simulation and 1v1 / 3v3 / 5v5 authoritative ranked **DEV server code only**.
- Ranked live settlement is **disabled** in the existing staging EAS profile. Private Supabase SQL has been verified in disposable PostgreSQL CI but not installed to the paid shared live BUKLOD database; never turn on Diamond reservation without authenticated WSS, verified account data, RLS/concurrency runtime gates and owner-approved production-grade isolation.
- Full-body procedural motion files are **not** hand-animated artist-approved 360° skeletal rigs. Visual parity and FPS on Infinix X6852 remain unverified.

## 3. Community Village / personal development

- Community Village now has its own locally packaged nature-scene map with distinct Personal Lot, House/Rooms, Community Estate and Business/Farm doors. Each links to existing permissioned Personal Home, Cluster or Business features.
- Progressive Level 1–10 and five visible building stages are shown only as **nontransactional design previews**. This is not a claim of completed houses, owned land, purchased materials or verified progression.
- World advancement, room customization, inventory, trade, endless Mastery and construction are still protected by dedicated future authoritative asset approvals and backend receipts. The BUKLOD V2 asset catalog contains staged art/blueprints, but its per-level DXP, BP, materials and build-duration requirements are not fully specified. Do not report these as operational without durable server-side validation and owned high-fidelity art.
- Spendable BP, lifetime earned BP/Circle Rank, QMP, Character Diamonds and items must remain distinct. Transfers/sales **never mint** lifetime BP, positive QMP or Character Diamonds. Business trading transfers legitimate BP only; no passive BP generation.

## 4. What must pass before staging OTA-ready

1. Exact consolidated **head commit** CI green: protected feature-lock, map/one-tap/guide tests, AdMob-first-view/navigation/audio focus, full TypeScript, Android Metro asset export, authoritative server tests and disposable PostgreSQL safety.
2. Signed **existing** staging APK native source/runtime parity: Android package `org.mzbministry.buklod.staging`, runtime `2.0.0-genesis-preview`, EAS channel `season2-genesis-preview`; **not** a new APK/staging subscription.
3. Correct EAS Preview Supabase public URL/key, existing paid backend, strict `EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED=false`; production EAS mapping unchanged.
4. When actually publishing, independently query remote EAS OTA group/runtime/source and Android manifest, reject duplicate release and preserve production channel. Source CI and a self-written JSON are **not** publication proof.
5. Physical screenshot/FPS/ad-fill and interactive Android test play remain **not actually verified**, as previously waived by owner. Waiver of manual QA is not a successful test receipt.

**Status contract:** DEV source implemented and tests may be green. No staging OTA ready/production claim without exact provider receipt or a verified gated release candidate. The complete virtual land/commerce backend, authored interior assets and real-time ranked Diamond settlement cannot be represented as live merely because source previews exist.
