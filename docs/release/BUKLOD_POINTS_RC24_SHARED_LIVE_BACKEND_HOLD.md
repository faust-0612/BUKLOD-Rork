# BUKLOD Points — RC release decision, 2026-11-24

**Outcome: BLOCKED BEFORE RELEASE.** This is an evidence receipt, not
a production/staging OTA publication and not a request to create an isolated
Supabase backend.

## Verified candidate
- Main baseline: `9aed7d6ad8b6d0ad80aa71daaf66962e9d49de04`.
- Staging-compatible code: `5b83062b4a0adffcf375aa1c1daed6f528c87563`.
- Source QA: https://github.com/faust-0612/BUKLOD-Rork/actions/runs/45235287614
  - 19 focused claim/AdMob/regression contracts passed.
  - TypeScript noEmit passed; unchanged native/build inputs.
- Existing single-event claim RPC and RLS-protected ledger reads are
  compatible; no schema migration is needed to render individual cards.
- New SSV +5 point backend remains isolated in DEV code only, disabled,
  and was not deployed to live Supabase.

## EAS verified on read-only preflight
- GitHub RC preflight workflow:
  https://github.com/faust-0612/BUKLOD-Rork/actions/runs/45236716591
- Staging signed APK build id: `bc4be208-bfb0-42f3-95cb-358353d0600f`.
- Staging Android package: `org.mzbministry.buklod.staging`.
- Runtime: `1.3.2`; channel: `staging-user`.
- Production channel mapping differs from staging; independent production
  manifest returned successfully during the preflight.
- **Critical:** EAS preview `EXPO_PUBLIC_SUPABASE_URL` points to the
  existing live MAIN Supabase project `yhanxndaqbmuzbdqlblu`.
  Automated check `PREVIEW_BACKEND_SHARED_WITH_LIVE=true`.
  Preflight deliberately failed with exit code 20 under the owner's
  "prepare changes that affect live" constraint.

## Not released
- No Expo/EAS `update` publication was executed by this candidate.
- No production/main GitHub merge, database migration, Edge Function
  deployment, QMP/Bayanihan ledger mutation, or AdMob setting change.
- This candidate changes the manual claim UI but its existing RPC would
  mutate real member balances when operated from the shared staging
  backend. Replacing it with a disabled UI would regress functioning
  claiming, so an incomplete preview-only OTA is not permitted.

## Safe continuation
- Preserve DEV and reviewed source SHA; do not rebuild native.
- Future owner-authorized release must distinguish intentional legitimate
  member claims against the shared MAIN backend from backend rollout or
  unreviewed staging tests, and pass privacy/account/ad/navigation gates.
- +5 ad bonus must remain off until Google's signed SSV credit is verified,
  with duplicate protection, daily cap and QMP isolation.
- Never describe a source QA pass as a staging OTA release receipt.
