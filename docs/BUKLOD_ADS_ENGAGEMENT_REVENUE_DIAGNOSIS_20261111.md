# BUKLOD Ad Impression Recovery · 2026-11-11

Live Android telemetry for previous 7 days: 8,628 ad requests; 3,459 loaded callbacks; 2,819 rendered; 1,292 client native/banner ad_impression callbacks; 2,906 failures and 205 interstitial dismisses. Client counts are not settled AdMob billable impressions or synchronized one-to-one request chains; full-screen interstitial OPENED is tracked as ad_rendered, not ad_impression. A raw 1,292/8,628 ratio therefore cannot be called a paid fill rate.

Failures include 1,647 explicit no-fill and 958 AD_ERROR; no-fill comes from ad demand, not lack of on-screen placement. Most valuable optimizations are higher *real* match and show rate, quality of impressions, device connectivity and active time.

**Source change:** one compact labelled AdMob banner after organic public Wall comment threads, only on Android, only when comments are rendered, not author-only or failed. It uses SDK viewport/consent/remote flags and exact impression callbacks. No action-tied interstitial, no auto refresh, no money for watching ads. SDK failures without explicit code are now categorized by safe whitelist rather than AD_ERROR.

**Operator checks before promises:** inspect official AdMob by unit for match rate, show rate, observed eCPM, policy serving restrictions, mediation waterfall, consent, test/live IDs, app-ads.txt. Reconcile settled QMP from *finalized eligible revenue*, not from earned BP or ad views. Google AdMob disallows interstitial after every action and direct cash via rewarded ads. https://support.google.com/admob/answer/6201362 https://support.google.com/adsense/answer/9121589

**Release:** DEV only, no native/DB change, code locked by existing mandatory ad test in PR, compiled RC and production OTA. Physical fill remains unverified until Android acceptance; no separate OTA publication.
