# BUKLOD AdMob fill and canonical Finance revenue gates — Nov 11 2026

## Live evidence
Private production AdMob telemetry (Nov 9–11) exhibits high native/banner no-fill and opaque previous AD_ERROR. Client events cannot substitute for real AdMob match rate, show rate, billed impression count or estimated earnings. Interstitial OPENED is an SDK-visible ad_rendered event, **not** an artificially manufactured ad_impression. No increase to reaction-triggered interstitial frequency, hidden refresh, or ad-watching cash rewards is authorized.

## Verified fixes
- Reels sponsored rows recycled inside the shared 2-minute request cooldown previously permanently set nativeFailed and bannerFailed, with no recovery. They now publish an unavailable state without blocking playback, wait for the same shared request cooldown, then retry once the cooldown expires. Proper timeout cleanup prevents a request storm.
- Each NativeAd, BannerAd, Reels and Interstitial event now records an allowlisted ad_format label via existing JSONB metadata; this separates no-fill by real SDK creative format without exposing identifiers or users. Reels fallback BannerAd now records its own ad_request, rather than pretending only native was requested.
- Production compiled RC checks all required live AdMob configuration flags and ad unit presence (without printing values) before building and requires exact Android package/project/runtime SHA.
- System-admin Finance readiness shows explicit month-close blockers from the existing authoritative `admin_get_buklod_pf_qmp_readiness_v1`; never enables finance or pays from BP/estimated AdMob previews.

## Current production blockers (READ ONLY)
2026-11-11: private.buklod_pf_config user_pool_bps=3000, economics=false, settlement=false, withdrawal=false, payout_processing=false. Finance finalized_value_ledger=0, pf_settlements=0; seven financial_entries are all OPERATING_COST debits, not eligible revenue. Community QMP periods for September, October, November remain OPEN. There is no source-backed eligible settled revenue to distribute; do **not** activate Finance flags, settle a month or promise fixed pesos per BP.

## External AdMob tasks
The AdMob publisher console is not connected to these tools. Google recommends inspecting Policy center, match/show rates, eCPM floor, ad-blocking controls, mediation, app-ads.txt and app/account restrictions. No-fill can be due to actual advertiser demand. Changes to eCPM floors or mediation require publisher-account access. Official source: https://support.google.com/admob/answer/9655701 and https://support.google.com/admob/checklist/10424733.

## Release
DEV -> mandatory PR + TypeScript + production AdMob config check -> compiled Android/Web exact SHA -> RC freeze -> reviewed consolidated production OTA. No independent release; no new native dependency/DB migration; no financial writes.
