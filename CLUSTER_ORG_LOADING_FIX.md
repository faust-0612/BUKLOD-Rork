# Cluster/Organization loading fix

Base: 82187b0fc4c3575d51d5a23c95fb3eddabb5e51b. Its duplicate-load and stale-media protections are preserved through per-resource in-flight deduplication, resource versions and scope/account generations.

Cluster Home now loads notices and settings first. Optional widget data is fetched on selection. Each completed resource updates independently; polls remain an atomic group of poll/options/votes. Presentation cache is partitioned by account, scope, admin mode and local date, bounded to 160 resources with 90-second freshness. Offline reads retain available content. Reads time out after 10 seconds; this bounds the UI wait rather than cancelling the underlying network request.

RSVP, task completion, vote, check-in, creation and customization refresh only their affected resources. Server write and permission APIs are unchanged. Community text does not wait for media signing; outdated media results are rejected.

The shared Show Faith panel used by Cluster and Organization runs one access refresh per focus instead of mount plus focus. Existing content remains during same-context revalidation. Daily reading/access waits are bounded. Admin gates distinguish connection errors from denied access, offer Retry, and reject obsolete responses.

Validation completed locally:
- node scripts/test-cluster-home-loading.cjs: cache freshness, deduplication, account keys, mutation refresh, failure retention and timeout recovery.
- node scripts/test-cluster-loading-render.cjs: actual React rendering with mocked backend, two initial reads, lazy Tasks, targeted mutation refresh, cache reuse, error retention, offline behavior, account separation, stale-scope rejection and admin retry.
- TypeScript 6.0.3 syntax/transpilation for changed components; strict type checking of the standalone cache helper; diff whitespace check.

The render test requires matching react and react-test-renderer 19.2.3 plus TypeScript 6.0.3; these were installed in temporary validation tooling without changing product dependencies.

Not yet verified: full application TypeScript, Expo export, actual Android device/network timing and live production behavior. No APK/AAB, web deploy or OTA is part of this DEV commit. Organization summary caching and sequential admin-content loading are not redesigned by this patch.
