# V28 cloud continuation audit — 21 October 2026

Status: **OTA NOT READY; RC UNFROZEN**.

## Scope and fresh evidence

Read-only GitHub inspection pinned to bfb3dea41514672feb903a669dbe99780b96d050; the DEV Git ref was freshly checked at that SHA before this documentation commit. Read AGENTS.md, the Engineering Charter, 21 October release results, latest RC candidate, full APK provenance manifest and Android acceptance checklist. The explicit cloud-only DEV instruction governs this run.

No owner-PC shell, filesystem writes, downloads, installs or builds were performed. No cloud runner, paid infrastructure, native build, workflow dispatch, main merge, Expo publication or database mutation was started. GitHub connector reads and this documentation commit are the only repository operations. No product, asset, dependency, test or native file is changed.

Historical verification is retained, not rerun: Jest 93/93, TypeScript PASS, P0/locked SDK 28/28, 1,217 exact product files and controlled exports 247/247 identical. The placeholder HBC SHA-256 remains 0934c43594b122faeceb05c96267186868765151fd5c63fdb384c476209cc6c7. It is not a production artifact.

Fresh GitHub evidence:
- DEV branch run listing returned three failed runs: 39536165897, 39378181586 and 39378175482, at older source SHAs. Run 39536165897 returned zero jobs and zero artifacts through the dedicated jobs/artifact tools. This does not establish the cause of failure.
- The repository releases collection returned an empty list.
- The first 100 repository runs were inspected; this is a bounded search, not an exhaustive audit of 7,284 runs.
- Repository-wide artifact and workflow-file-specific run URLs were rejected by the connector endpoint allowlist. No conclusion about their contents is drawn.
- The complete recursive Git tree returned truncated=false. No newer V28 candidate or separately named receipt artifact was identified in its paths.
- No Expo connector or existing general cloud execution session was established in this run. No fresh Expo channel/runtime service verification is claimed.

## Remaining gate disposition

| Gate | Result from this continuation | Exact missing evidence |
| --- | --- | --- |
| Production-configured candidate | NOT EXECUTED | Existing free cloud executor and verified environment input source accessible to it. Re-export twice with identical pinned inputs; compare complete manifests. Do not retrieve secret values into chat or infer them from examples. |
| Historical APK/source binding | UNPROVEN | Original build record binding the fingerprinted APK to source commit/tree, lockfile, compiler/toolchain, environment and embedded export; source map if retained. |
| Non-production BSOC/referral | NOT EXECUTED | Identified non-production Main backend, authorized test session and redacted authoritative receipt/result evidence. Existing receipts may be inspected read-only; generating registrations/referrals/health events entails backend mutations and is not authorized by this run's no-mutation rule. |
| Android acceptance | PREPARED, NOT EXECUTED | Existing authorized runtime 1.3.4 harness loading the exact candidate, device identity and per-case receipts/timings. |
| Photo bottleneck | STATIC PIPELINE INSPECTED; NOT MEASURED | Android stage timings, HTTP/expiry/cache/decode evidence under controlled fixtures and network profiles. |
| Immutable RC | NOT FROZEN | All mandatory gates, exact production artifact identity, runtime compatibility and candidate-device results. |

The APK SHA-256 is 820ff2c74e63a63a371b7b88466b24c4b0c324b1ae619a140e241c719f428a95; embedded bundle SHA-256 is 38a36b0a5ab7533f487ea227d47450805b4ac39cb7a5e96f3e2a57a8fadfc939. The 193 asset matches do not prove source parity. The inspected production_android_apk.yml points to an older frozen RC 354de4763e4e1d24ecbb3e3811c7f3c231e9714f and version 1.3.0 checks; that workflow declaration is not provenance for the independently fingerprinted V28 APK. It was not run.

## Separate photo pipeline inspection

All observations below are source observations at the pinned SHA, not measured Android bottlenecks:
- src/app/(tabs)/buklod.tsx starts loadCommunityPostMediaByPostIds once for the feed and wraps its initial contribution in a 650 ms timeout (lines 1364–1414). The Promise.all also waits for name hydration and a separately bounded reactions read. The 650 ms constant is not a measured total feed deadline.
- The same screen resolves photo URLs ahead of prefetch for up to 32 media items, using Promise.all, then calls prefetchCommunityMedia (lines 1706–1764). The helper caps a burst at 36 unique URLs. Network contention and time-to-prefetch require measurement.
- src/lib/buklodCommunityPostMedia.ts fetches metadata via get_buklod_post_media_v2, falling back to v1 only for a missing RPC. Photos remain lazy. Video URL materialization participates in the metadata Promise.all. Whether mixed video/photo rows delay photo metadata requires tracing.
- src/lib/buklodMediaUrl.ts hydrates AsyncStorage before resolution, shares in-flight signing by path, batches after 20 ms, bounds signing with a 6,000 ms caller timeout, caches signing failures for 45 seconds and successful entries for 50 minutes; generated Supabase URLs request 3,600 seconds. Caller timeout alone is not proof of transport cancellation. Preferred URL freshness cannot be inferred solely from time cached.
- src/components/BuklodCachedMediaImage.tsx uses ExpoImage memory-disk caching, a path-based cache key when available, high priority and native recyclingKey. Its error handler requests re-signing; no explicit per-image retry budget is visible in that component. Its memo comparator does not compare style/onLoad. These observations are investigation targets only, not approval for code changes.
- src/components/BuklodCommunityPhotoCollage.tsx renders at most four tiles and derives single-photo aspect ratio from onLoad.

No isolated DEV repair is justified yet. No thumbnail, cache, signing, renderer or retry rewrite was implemented.

## Exact measurement protocol to accompany existing Android tests

Use V28_ANDROID_ACCEPTANCE_20261021.md as the mandatory scenario/outcome checklist, including LOAD-1–3, AUTH-1–4, SIGNUP-1, REF-1–2, BSOC-1–3, REG-1 and PHOTO-1–3. All remain NOT EXECUTED here. Use dedicated fixtures already provisioned in the authorized test environment; do not upload to production or create test records under the current no-mutation restriction.

For each photo trial record an opaque trial/fixture ID, candidate SHA/tree and artifact hashes, Android OS/device/runtime, renderer, network profile and cold/warm cache state. Use a single monotonic clock for client durations; correlate proxy durations using a trial ID rather than subtracting unsynchronized timestamps. Retain only allowlisted data, never raw URLs, signed query strings, credentials or personal content.

Capture these stage boundaries:
1. Screen open, cached text visible, feed request start/end, text first visible.
2. Metadata RPC start/end, media metadata attached to row, tile mounted.
3. Cache hydration start/end, signing queued/start/end, URL class and expiry-validity verdict.
4. Image request start, headers, last byte, HTTP status, content type, transferred bytes and cache source if observable.
5. Image onLoad/onError and first visible frame. Record request/sign/retry counts per fixture. Native load completion alone is not proof of first paint.

Run the existing normal, offline and 128–256 kbps / 400–1200 ms profiles with the same fixture set for baseline and exact candidate. Separate small valid photos, large photos, mixed photo/video rows, expired signatures, 403/404 and stalled-body trials. Observe one bounded trial per scenario first; repeat only to resolve a failure, relevant fix or measurement ambiguity. Stop each manual capture at 60 seconds and mark an incomplete load explicitly, rather than leaving it running indefinitely. Existing tighter loading/auth thresholds still govern PASS/FAIL.

Attribute delay from actual stage durations: metadata wait, signing wait, transfer, or decode/paint. Record overlap; do not add overlapping durations or equate a configured timeout with observed latency. If a stage cannot be observed, mark it unknown. Propose the smallest isolated DEV change only after the slow/failing stage is demonstrated, then rerun the affected scenario and appropriate regressions before RC qualification.

For BSOC/referral evidence, require backend designation, source/artifact identity, session validity without token disclosure, opaque stable retry ID, authoritative receipt/result and an observed queue/attachment transition. A fake-HTTP SDK pass, successful HTTP status alone, screenshots of a baseline app or a production account cannot replace these receipts.

## Continuation inputs

An existing free cloud executor with secure environment access, an identified non-production Main backend with existing authorized receipt evidence, and an existing runtime 1.3.4 Android harness are needed to execute the blocked gates. References were requested in chat; no secrets were requested. Until available, retain the completed verification and do not repeat prior investigations, freeze an RC or publish OTA.
