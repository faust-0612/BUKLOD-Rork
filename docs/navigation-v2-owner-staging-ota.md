# Owner-authorized staging OTA — 13 November 2026

This cycle is explicitly limited to Android `staging-user`, EAS preview environment,
package `org.mzbministry.buklod.staging`, runtime `1.3.2`, and the isolated DEV branch.
No main merge, native build, web, Play Store or production release is authorized.

The previous prepublish policy conflates OTA compatibility with full installed-device
acceptance and the deferred native IME feature. Changing that shared policy or
marking the 21-item checklist verified would misrepresent evidence. A separate
staging-only policy therefore validates exact-source CI, signed-binary provenance,
unchanged app/native/dependency source since APK build 10, actual channel isolation,
preview export, EAS publication metadata and update-server delivery. Original
`navigation-v2-staging-gate.mjs`, its evidence and checklist stay unchanged.

Physical-device acceptance: **SKIPPED BY OWNER**. It is never reported as passed.
Native Android IME `commitContent`: **DEFERRED BY OWNER**. Existing GIF share
fallback stays intact. No 21/21 UX, memory/crash acceptance, or device delivery is
inferred from compile tests or a server-side OTA manifest.

Signed APK: EAS `bc4be208-bfb0-42f3-95cb-358353d0600f`, versionCode 10,
source `c6804e5b6b72e6bb7658f5b13e32dd8a5d1de9fd`, APK SHA-256
`6d271a071262ca8a35864bcf67695521abf36a1497ea21d6cecb529a1966835e`.
Provenance: GitHub run 43396193176 / artifact 14023939551. This is signed-binary
provenance; it does not attest which binary is installed on the owner's device.

The one-time push prefix `BUKLOD_OWNER_STAGING_OTA_20261113:` and exact isolated
branch constrain the new workflow. Four mandatory CI suites must succeed for its
exact SHA before Expo credentials are used. Publication is not retried blindly;
reruns first inspect the exact-source message. A separate EAS read and protocol
manifest query verify actual publication, package, runtime and ID. A production
manifest is read before/after and its ID must stay unchanged. Lightweight receipts
are retained as the workflow artifact; APKs and exports are not uploaded there.
