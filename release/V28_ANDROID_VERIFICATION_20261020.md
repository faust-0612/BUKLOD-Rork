# V28 P0 Android verification — pending physical-device evidence

Status: NOT EXECUTED. No OTA or native APK was created by this engineering run.

## Prerequisites and evidence

- Use an existing authorized Android test harness capable of loading the exact candidate JS/assets on native runtime 1.3.4. The installed production V28 baseline alone cannot validate the new candidate code. Do not publish production OTA or rebuild native code to bypass this prerequisite.
- Record candidate Git commit, bundle/asset hashes, Android build 28/runtime 1.3.4, device model/Android version and network profile. Use dedicated test accounts A/B and a compatible non-production backend. Do not record passwords, bearer tokens, email addresses or phone numbers in evidence.
- Run once per scenario; repeat only after a failure or relevant fix. Stop release if any mandatory case fails. Retain device logs with identifiers/tokens redacted.

| ID | Action | Required result / evidence |
| --- | --- | --- |
| AUTH-1 | Valid login on normal network; restart the app. | Correct account/session persists; no duplicate password grant; no other account's data. |
| AUTH-2 | Black-hole the password response headers. After the bounded failure, restore network and explicitly retry. | Underlying auth transport ends around its 10s deadline; UI becomes usable within the 12s caller window plus device scheduling tolerance. Exactly one active client attempt; retry succeeds. |
| AUTH-3 | Deliver auth headers, stall response body, then deliver the old body after a second successful login. | First attempt times out; late result never changes the active account or fires a stale SIGNED_IN event. |
| AUTH-4 | While A's login is pending, submit B's credentials. | B receives an in-progress result; no credential/result mixing. After A ends, an explicit B retry is processed normally. |
| AUTH-5 | Explicitly sign out while a grant is pending; allow its late response to arrive. | Grant cancellation prevents session resurrection; a later explicit login can succeed. |
| AUTH-6 | Wrong password, server 503, connection drop, background/foreground and route remount. | Specific failure feedback; no automatic password retry storm; correct session identity and safe retry behavior. |
| AUTH-7 | Delay native auth storage or an auth-state subscriber independently of HTTP. | No unsafe second session mutation. Document any persistent lock; it remains a release blocker rather than forcing an unlock. |
| CACHE-1 | Load saved content, restart offline, then reconnect with 128–256 kbps and 400–1200 ms latency. | Saved content appears without waiting for remote data; refresh is bounded; reconnect refreshes content. |
| CACHE-2 | Trigger pull-to-refresh/remount concurrently, then switch account/scope before the old result returns. | One underlying request per active scope; old result cannot overwrite the new scope/account. No personal content crosses accounts. |
| CACHE-3 | Stall safe-read headers/body and fail local cache writes. | Loading indicators stop; existing content survives; user sees retry feedback; storage cannot hold successful content rendering. |
| REF-1 | Select a valid referrer suggestion and create a dedicated test account. | Account is created once; canonical code is attached by the authoritative RPC without a redundant client lookup. |
| REF-2 | Test missing session, invalid code and already-recorded referral. | Account creation is not falsely described as a total failure after success; referral status is accurate; no duplicate registration/attachment. |
| BSOC-1 | Cause an auth/loading failure while signed out and offline; close/reopen the app before signing in. | A fixed-code event persists locally without credentials, names, identifiers, arbitrary routes or raw errors. No unauthenticated health RPC is issued. |
| BSOC-2 | Repeat the same failure concurrently within five minutes, then sign in and reconnect. | Events deduplicate locally; authenticated delivery uses the session then active, with no claim about the identity at capture. Stable event ID survives retries. |
| BSOC-3 | Return a network error or a response without event_id; then return a valid server receipt. | Event remains queued until acknowledgement; valid receipt removes it; no duplicate backend event on ambiguous retry. |
| BSOC-4 | Change/sign out the session during a drain; exercise 23h expiry, queue capacity and storage failure. | No unauthenticated delivery or identity leak. Expired events are discarded before the backend's 24h cutoff; bounded memory fallback is documented. |
| REG-1 | Open existing protected navigation, Character, points, quiz door, calls/PTT and DZAS paths using the test harness. | Behavior matches the approved baseline. Do not alter Community Wall media or upload test media to production. |

## Evidence needed to close the device gate

For each row, record PASS/FAIL, timing/request counts, redacted client logs and (for BSOC/referral) the non-production server receipt or result. A screenshot of an installed baseline or passing Node tests is not candidate-device verification. The RC remains unfrozen until all mandatory cases and source/export provenance gates pass.
