# BUKLOD Empire Arena — dedicated STAGING backend deployment contract

The Arena is a screen inside the **single BUKLOD Main Android app**. This
directory packages its **trusted infrastructure**, not another APK or account.

## Release-state invariant

This source is **NOT deployed** merely because CI passes or a Dockerfile exists.
No paid branch, production SQL change, main app release or actual Android device
result is implied by this document.

## Zero-production-change staging prerequisite

1. Use an explicitly approved, separate **Supabase preview branch** with its
   own Auth, PostgreSQL and API keys. BUKLOD MAIN project
   `yhanxndaqbmuzbdqlblu` is a read-only baseline for this staging task.
   Never apply `supabase/changesets/arena_v2_ranked_private_schema_DEV_ONLY.sql`
   to MAIN or another app database. Branch creation has a separate per-hour
   compute charge and requires explicit owner agreement.
2. Apply and inspect the reviewed ranked SQL change set **only in the
   disposable preview branch**. Verify RLS/GRANTs, verified participation
   Diamond claims, all-seat reservations, win/loss, cancellation refunds,
   crash-expiry refunds, and concurrent double-submit behavior.
3. Run the server container from repository root:
   `docker build -f services/empire-arena/Dockerfile -t buklod-arena-staging:dev .`
   Pass **server-side only** `ARENA_SUPABASE_URL`,
   `ARENA_SUPABASE_PUBLISHABLE_KEY` and `ARENA_SUPABASE_SECRET_KEY`
   from protected host secrets. Never commit keys or put service-role keys
   in an APK, EAS update, public environment variable, build log or URL.
4. The current `ArenaMatchCoordinator` queues and game states are
   **in-process**. Run exactly **ONE** authoritative instance behind
   HTTPS/TLS reverse proxy, serving `wss://<your-staging-host>/arena-v2`.
   Horizontal replication/load balancing is blocked until a shared,
   transactionally authoritative coordinator/queue is implemented. Merely
   deploying a Vercel WebSocket Function with multiple instances is NOT safe
   matchmaking for these stateful matches.
5. Confirm `GET /readyz` returns 200, and keep server rolling metrics,
   health checks, graceful stop, transaction refund recovery and limited
   connection lifecycle active. Exercise the **real live staging WSS** with
   at least two dedicated staging users and separate devices.
6. **Staging Android build only:** set `APP_VARIANT=staging`,
   `EXPO_PUBLIC_APP_ENV=staging`, and supply the **same preview branch
   Supabase Auth URL/publishable key** used by the server. Once the live
   endpoint is verified, set
   `EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED=true` and
   `EXPO_PUBLIC_BUKLOD_ARENA_WS_URL=wss://<staging-host>/arena-v2`.
   Otherwise ranked must remain disabled, while offline practice works.
   Staging package: `org.mzbministry.buklod.staging`.
7. Build a reviewed staging APK/OTA from a **frozen CI-green SHA** and
   compatible Android runtime. Verify complete source ancestry, EAS build
   ID, exact channel and runtime, CI gates, AdMob load lifecycle,
   first-view/navigation responsiveness, landscape entry/exit and safe-area.
   Do not publish a staging OTA merely because Metro export succeeded.

## Must-pass live playtest

- Real 1v1, 3v3 and 5v5 users (not bots masquerading as users), two
  directions of skill/attack movement, same hero/gear eligibility as
  validated by private SQL, server-owned HP/winner/rating/Diamond results
- Lost last available Diamond is held exactly once; reconnect within 20s
  resumes the same seat without a second reserve. No remote server result
  can be forged from the client.
- Match defeat causes the correct earned Diamond loss/rank demotion;
  legitimate win refunds stake, crash/abort returns all holds idempotently.
  BP and QMP are unaffected and lifetime Circle Rank is not minted.
- 13 characters × 4 full-body motion states, readable landscapes,
  low-end Android FPS/memory, offline/background audio cleanup,
  weak-network resume, no audio/ads overlay on the attack controls.
- Compare **physical device screenshots/video** to owner-approved visual
  samples. Source-only or static CI tests cannot certify premium fidelity.

## Local/CI verification

`node --test services/empire-arena/tests/core.test.mjs services/empire-arena/tests/gateway.test.mjs`
`python scripts/verify-buklod-arena-motion.py`
`npx expo export --platform android --output-dir /tmp/buklod-arena-android --clear`

No additional image download/save in ChatGPT Library is required:
source-approved image bytes are SHA-256 versioned in
`assets/season2/arena/generated/` and imported via Metro static requires.
