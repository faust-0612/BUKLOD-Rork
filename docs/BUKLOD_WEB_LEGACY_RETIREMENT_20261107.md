# BUKLOD Main Web — Legacy Retirement, 2026-11-07

Source baseline before this workstream: `362ea3a8946a15725c043ba17e36174e6eb853f4`. This is not evidence that production Expo Hosting already has this SHA.

## Authoritative web identity
- The single authoritative Main **web** brand image is `assets/release/buklod-main-canonical.png`, the green B/BUKLOD mark already used by startup.
- `public/buklod-brand-r2-512.png` shares identical Git blob bytes with the 512×512 canonical mark; its new URL defeats stale favicon caches.
- Manifest, favicon, Apple touch icon, desktop public/scoped header, web login fallback and web registration all use the canonical asset.
- Obsolete ZION `public/buklod-192.png` and `public/buklod-512.png` have been removed. Their replacements are correctly sized canonical 192px and 512px icons, both verified as valid PNGs. The 192px icon was resampled from the canonical 512px asset; the 512px icon is byte-identical.

## Retired release mutation
- Removed both old `patch-web-community-post.cjs` and `patch-home-identity-action-row.cjs`.
- Former web-only Guide exit is now an explicit `Platform.OS === 'web'` branch in checked-in code. Android behavior remains intact.
- Production web workflow validates source contracts and fails if tracked source changes during export; it still retains protected EAS credentials and exact SHA guards.
- `dist-web/` is an obsolete checked-in historical output, **never** a release input. Production generates `dist` afresh.

## Untouched boundaries
Android native icon, package, runtime, version code, OTA, Classroom standalone project, database, ad identity, and open DEV branches are not modified. Source changes are not a claim of live Expo Hosting verification.
