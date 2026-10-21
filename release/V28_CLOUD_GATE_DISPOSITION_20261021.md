# V28 cloud gate disposition — 21 October 2026

Status: **OTA NOT READY; RC UNFROZEN**. Cloud-only execution. Parent DEV head freshly verified as `a28c4c6e24a7cc6bf80b7fca722fa98b36e1f76c`; its cloud continuation audit is preserved unchanged.

## Fresh work in this continuation

- Read the Engineering Charter, latest candidate/APK provenance/export evidence, cloud continuation audit and Android acceptance/measurement protocols.
- Confirmed this existing Codex Cloud executor and recovered workspace are available. No owner Windows PC access, downloads, installs or builds occurred.
- Inspected only names/presence of relevant injected environment variables: none were present. Inspected workspace env-file metadata: only `.env.example` was present. The complete Git tree was not truncated and contains `.env.example`, `.env.production.example` and `.env.staging.example`; none is an authoritative production input source.
- Inspected EAS profile metadata without exposing values. The production profile names the production channel/environment, but its inline env keys are only APP_VARIANT, EXPO_PUBLIC_APP_ENV and EXPO_PUBLIC_STREAM_ANDROID_PUSH_PROVIDER_NAME. A profile declaration does not supply or attest the remote environment values. No EAS CLI, local EAS executable, Expo auth-state file or Expo-specific connector is available here. No login or external environment retrieval was attempted.
- Inspected source environment-reference identifiers without printing values. Required client backend inputs include EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Other source/config references cover maps, ad configuration, stream/video/report/GIF integrations and feature-policy overrides. Their intended production values or intentional omission/defaults must be established by an authoritative input manifest; this inspection does not assert every optional key is required.
- Four local export-input/tool files match the current GitHub blobs exactly: package-lock.json (`6a4eb5ba4698cc169cec0fd26d0d5c70e5567e74`), app.config.js (`e1dae6d4f54f40c1bf46375a359335c2562e41ec`), eas.json (`1d782a39147dd0930c0b47ae7915cfcf075f9a03`) and scripts/export-v28-reproducible.cjs (`cd93c98211e44a2ec03db305b65701a26423b7ac`). No full product reconciliation was repeated; the coordinating chat's fresh 1,217-file Git blob/size reconciliation is retained as reported evidence.
- Reviewed prepared LOAD/AUTH/SIGNUP/REF/BSOC/REG/PHOTO scenarios and the separate monotonic-clock stage measurement protocol. They already require exact artifact/runtime identity, controlled network/fixtures, redacted per-stage evidence, bounded observations and authoritative receipts. No speculative protocol or product/media rewrite was warranted.

All shell commands were bounded to 5–15 seconds. No secret values were printed or committed. No dependencies installed, tests rerun, exports generated, database operations performed, device sessions initiated or paid services created.

## Retained verification, not fresh reruns

Retain bfb3dea41514672feb903a669dbe99780b96d050 evidence: Jest 93/93 in 18 suites; TypeScript PASS; P0/actual locked-SDK tests 28/28; protected/base contracts PASS; 1,217 product files; controlled placeholder exports 247/247 identical. Their HBC SHA-256 remains `0934c43594b122faeceb05c96267186868765151fd5c63fdb384c476209cc6c7`. This is not a production artifact. Five fake-HTTP SDK tests are not actual backend receipt evidence.

## Explicit gate disposition and concrete requirements

| Mandatory gate | Status | Requirement to execute/close |
| --- | --- | --- |
| Production-configured reproducible exports | BLOCKED | Securely provision an authoritative Android Main production input manifest/values to this cloud executor, or provide an existing authenticated read-only environment source. Record source/project/environment/version and intended optional defaults without secret disclosure. Then run the pinned wrapper twice with bounded commands and compare all output hashes. Do not substitute example/placeholder inputs or infer production from APP_VARIANT alone. |
| Historical APK-to-source binding | UNPROVEN / BLOCKED | Original retained build/source evidence tying the known APK fingerprint and embedded bundle to source/tree, lockfile, toolchain and environment, or complete the documented alternative candidate qualification. No new binding is supplied by current release evidence. Asset matches alone are not parity proof. This is not a claim that every historical run/archive has been exhaustively searched. |
| Actual non-production BSOC/referral receipts | BLOCKED | Owner confirms no designated non-production Main backend or authenticated test session is established. Require that designation and authorized existing receipt/result evidence, or separately authorized test mutations there. Current no-database-mutation restriction remains in force. Never use production accounts as substitutes. |
| Physical Android acceptance | BLOCKED | Owner confirms no runtime 1.3.4 Android harness is established. Require an existing authorized harness loading the exact qualified candidate and all checklist timings/results. No native build or Production OTA may be used to bypass this prerequisite. |
| Separate photo investigation | BLOCKED | Require Android HTTP/expiry/cache/transfer/decode/first-paint measurements under the prepared protocol. Static code observations do not identify a measured bottleneck or justify a media repair. |
| Immutable RC | BLOCKED / NOT FROZEN | Close all mandatory gates, verify production artifact identity/runtime compatibility and acceptance, then freeze the exact artifact manifest. |

The cloud executor itself is no longer a missing prerequisite. Verified production inputs, original build/source evidence or completed alternative qualification, non-production receipts and runtime-specific device/measurement evidence remain missing.

Only this disposition document and the candidate manifest are changed. The prior audit, Charter, tests, product/assets, lockfile, native files and export tooling are preserved. No main merge, workflow dispatch, native build, backend mutation, RC freeze or OTA publication.
