# Genesis Expo-free native carryover ledger — source audit, NOT parity

Native DEV started from `4b5660db61c24f481b2851b88603b1e301beda57`.
Authoritative `main` at audit: `7b224c39624827282c3cbf003060317045b0a73f`.
Branch is **behind MAIN by seven commits**; 76 paths were changed on the MAIN side compared with the native DEV branch. No wholesale merge of MAIN or prior Expo code is appropriate for an independent native host.

Functionality absent from the native Android application, requiring deliberate feature-by-feature migration and real device proof:

- Consent verification and login boot recovery — privacy/authorization cannot be a placeholder.
- Admin new registrations and mentor permissions — maintain server-side ACL/RLS.
- Cluster-admin check-in review and points — never give systemic authority to member clients.
- PTT preferences, receive/call handling and notification lifecycle — isolate audio focus and duty notifications.
- AdMob first-view rendering, lifecycle retention and fast dashboard navigation — permanent release gate.
- Home, Wall/media, Connect and Profile — still implemented in MAIN/Expo, not copied to native.
- Daily Bible offline, rank/points, character and Kingdom authoritative rewards — still absent native parity.

The native host currently exposes only a static DEV hub, verified-pack entry and three **visual previews** + offline Arena dev scene. The 39 Kingdom games are **not migrated**. No live/main backend is used. The `parity.json` stays intentionally unverified. Before RC, review every source delta against the then-current `main`, and test each independently migrated behavior. Source parity is NOT production or device equivalence.
