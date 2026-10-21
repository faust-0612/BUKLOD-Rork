# V28 candidate Android acceptance — not yet executed

Use the exact candidate bundle/asset hashes on an existing authorized runtime 1.3.4 Android harness, dedicated test accounts A/B and a designated non-production backend. An installed production baseline does not test candidate code. Record device/OS, commit, artifact hashes, network shaping and redacted request counts/timings. Do not rebuild native code or publish Production OTA to obtain a harness.

Run normal network, offline, then 128–256 kbps with 400–1200 ms latency. Apply failures to individual requests using a test proxy. Every row is mandatory unless explicitly marked diagnosis. No credentials, tokens, personal content or signed URL query strings in retained evidence.

| ID | Action | Exact acceptance outcome |
| --- | --- | --- |
| LOAD-1 | Prime each affected content screen, restart offline and open it. | Previously saved content is retained; cache hydration is bounded to 1.5s plus at most 2s device scheduling tolerance. A failed remote refresh cannot clear visible saved content. |
| LOAD-2 | Stall safe-read headers, then body; refresh/remount concurrently. | Refresh completes or reports failure within 12s plus 2s tolerance. One underlying active request per same scope; no indefinite loading or retry storm. |
| LOAD-3 | Switch A to B/scope while A's read is pending; release A's result. | No A content overwrites B/scope, including after remount/reconnect. |
| AUTH-1 | Login, restart, foreground/background, explicit logout and retry. | Only the correct session persists; logout does not resurrect it. |
| AUTH-2 | Stall password headers/body; attempt B during A; release old A after explicit B retry succeeds. | Client transport fails around 10s and caller feedback within 12s plus 2s tolerance. B is initially rejected as in-progress, then explicit retry succeeds. No overlapping SDK mutations, credential mixing, stale SIGNED_IN event or old session replacement. |
| AUTH-3 | Wrong password, 503 and dropped connection; separately delay native storage/subscriber. | Actionable error and safe explicit retry. A non-network SDK hang never permits unsafe concurrent auth; any persistent lock is recorded as FAIL/blocker. |
| AUTH-4 | Exercise password recovery using a dedicated test mailbox. | Recovery reaches the intended account and approved recovery route; no account enumeration, token leakage or automatic retry storm. |
| SIGNUP-1 | Register without referral, including slow response and double tap. | One test account is created. Existing successful creation is not misreported as complete failure. No duplicate submit/registration. |
| REF-1 | Select a resolved referrer, create account and inspect the non-production authoritative RPC result. | Canonical selected code is attached once; no redundant resolver request; returned account and referral outcomes agree. |
| REF-2 | Invalid code, missing session and already-recorded referral. | No false success or duplicate attachment; account creation and referral outcomes are reported separately and correctly. |
| BSOC-1 | Cause signed-out/offline auth/loading failures, repeat within 5min and restart. | Persisted queue contains only allowlisted operational codes and opaque retry IDs; no credentials/PII/raw errors/routes. Same failure deduplicates; no unauthenticated health RPC. |
| BSOC-2 | Sign into test backend; fail delivery or omit event_id; retry with valid receipt. | Stable client ID across retries; queue is retained until a valid event_id receipt, then removed. Backend receipt and dedupe result recorded with redacted evidence. |
| BSOC-3 | Sign out/change account during delivery; test 23h expiry, 30-event capacity and storage failure. | No unauthenticated delivery or cross-account personal data; bounded queue, expired events discarded, documented volatile fallback. |
| REG-1 | Navigation, Character/points, quiz entry, calls/PTT and DZAS. | Matches approved baseline with no new failures; no production test media uploads. |

## Separate measured photo investigation — unresolved, no media code change

Use dedicated non-personal photo fixtures and record URL class, validity/expiry, redacted HTTP status, content type/size, request start/end, image onLoad/onError, cache hit, renderer and feed timings on Android. Compare baseline and candidate under identical network profiles. Do not infer Android behavior from web.

| ID | Action | Required outcome/evidence |
| --- | --- | --- |
| PHOTO-1 | Known valid public/private fixtures on normal and weak network, with cold/warm cache. | Feed text remains usable while photos load. Each valid fixture renders; warm cache displays the same fixture offline when supported. Record measured first-visible and full-image times; do not mark PASS without device evidence. |
| PHOTO-2 | Expired signed URL, 403, 404, stalled body and oversized fixture. | Image failure never blocks feed/navigation/auth; bounded failure/retry feedback, no repeated full-feed reload or unbounded requests. Record expiry/renewal behavior before proposing changes. |
| PHOTO-3 | Scroll repeatedly through photo/video rows while other content refreshes. | No global loading stall/crash; record memory/frame/request behavior and compare baseline. Any failure opens a separate scoped media repair candidate. |

All device rows: NOT EXECUTED. A screenshot or Node/SDK test is not acceptance evidence. Photos remain a separate measured investigation and an unresolved Charter outcome.
