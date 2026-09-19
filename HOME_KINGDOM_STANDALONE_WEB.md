# BUKLOD Home + Kingdom Standalone Web Architecture

Status: source/staging architecture only. Production release remains blocked until the exact release candidate passes export, handoff, route, and regression verification.

## Contract

- BUKLOD Main remains the authenticated entry hub.
- Home and Kingdom are separate web bundles with separate Expo Router roots.
- Main web routes under `/personal-home/*` and `/games/*` are launcher boundaries, not feature implementations.
- Native Main behavior is frozen; the separation is web-only.
- Home and Kingdom reuse the existing feature source so business logic does not fork.
- Standalone apps have no independent login screen. A user enters through Main, which creates a one-time Supabase magic-link token hash on the server.
- Main access and refresh tokens are never placed in the standalone URL.

## Route roots

- Home: `src/standalone/home`
- Kingdom: `src/standalone/kingdom`

Build commands:

- `npm run web:home`
- `npm run web:kingdom`
- `npm run web:home:export`
- `npm run web:kingdom:export`

## Production configuration required

The Edge Function `buklod-surface-main-entry-v1` requires these server-side secrets before production use:

- `BUKLOD_HOME_WEB_URL`
- `BUKLOD_KINGDOM_WEB_URL`

Optional, only if these web targets are later assigned independent EAS projects:

- `BUKLOD_HOME_EAS_PROJECT_ID`
- `BUKLOD_KINGDOM_EAS_PROJECT_ID`

Do not point either standalone target at the BUKLOD Main EAS project ID.

The standalone client can optionally set `EXPO_PUBLIC_BUKLOD_MAIN_WEB_URL`; otherwise it returns to `https://buklod.expo.app`.

## Release gate

Follow the canonical process:

P0 CONTAINMENT -> STRUCTURE -> END-TO-END FUNCTION -> 1M SCALE HARDENING -> LOAD/FAILURE TEST -> RELEASE

Do not deploy production until:
1. Main web routes only launch the standalone apps.
2. Home and Kingdom exports are independently clean.
3. One-time Main-to-standalone session handoff works with no token leakage.
4. Refresh/direct URL/back navigation have no white screen.
5. Main native, Quiz, Classroom, Quick Check, and unrelated routes show no regression.
