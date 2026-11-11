import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path,'utf8');

test('Reels recycled no-fill or cooldown rows are retried without duplicate immediate requests',()=>{
  const reels=read('src/components/BuklodReelsInlineAd.tsx');
  assert.match(reels,/getBuklodPassiveAdRequestWaitMs\('reels_inline', requestKey\)/);
  assert.match(reels,/setRecycleRetryTick\(current => current \+ 1\)/);
  assert.match(reels,/return \(\) => clearTimeout\(timer\)/);
  assert.match(reels,/recycleRetryTick,/);
  assert.match(reels,/bannerRequestRecorded\.current = true/);
  assert.match(reels,/adFormat: 'banner'/);
  assert.match(reels,/adFormat: 'native'/);
  assert.match(reels,/AdEventType|NativeAdEventType/);
});

test('Ad operational events keep SDK-billed impression attribution and track bounded inventory format',()=>{
  const d=read('src/lib/buklodAdDiagnostics.ts');
  const telemetry=read('src/lib/buklodAdOperationalTelemetry.ts');
  const native=read('src/components/BuklodCommunityInlineAd.android.tsx');
  const banner=read('src/components/BuklodAdMobBanner.tsx');
  assert.match(d,/export type BuklodAdFormat = 'native' \| 'banner' \| 'interstitial' \| 'rewarded'/);
  assert.match(d,/adFormat = context\?\.adFormat \?\? null/);
  assert.match(telemetry,/adFormat: 'native' \| 'banner' \| 'interstitial' \| 'rewarded' \| null/);
  assert.match(telemetry,/metadata: row\.adFormat \? \{ ad_format: row\.adFormat \} : \{\}/);
  assert.match(telemetry,/event\.adFormat \?\? ''/);
  assert.match(native,/NativeAdEventType\.IMPRESSION/);
  assert.match(native,/adFormat: 'native'/);
  assert.match(native,/adFormat: 'banner'/);
  assert.match(banner,/onAdImpression/);
  assert.match(banner,/adFormat: 'banner'/);
  const fullscreen=read('src/lib/buklodAds.ts');
  assert.match(fullscreen,/adFormat: 'interstitial'/);
  assert.match(fullscreen,/OPENED proves the interstitial was actually presented/);
});

test('Main admin shows authoritative period blockers and refuses fabricated cash',()=>{
  const ui=read('src/app/admin/economy-operations.tsx');
  const blockers=read('src/lib/buklodFinanceMonthCloseBlockers.ts');
  assert.match(ui,/getBuklodFinanceMonthCloseBlockers\(qmpReadiness, controls\)/);
  assert.match(ui,/Finance settlement LOCKED:/);
  assert.match(ui,/controls\?\.economics_enabled === true/);
  assert.match(ui,/controls\?\.settlement_enabled === true/);
  assert.match(ui,/qmpReadiness\?\.ready_for_finalization === true/);
  assert.match(blockers,/No verified reconciled eligible revenue; AdMob estimates and BP cannot create cash/);
  assert.match(blockers,/Calendar month has not ended/);
  assert.match(blockers,/Finance economics remain disabled/);
  assert.match(blockers,/Canonical settlement remains disabled/);
});

test('AdMob production live-unit preflight runs BEFORE compiled RC and exact source identity still holds',()=>{
  const workflow=read('.github/workflows/unified_rc_compiled_qa_20261108.yml');
  const check=workflow.indexOf('node scripts/verify-production-ads-env.cjs');
  const exportAndroid=workflow.indexOf('Compile V28-compatible Android OTA bundle');
  const exportWeb=workflow.indexOf('Compile Main Expo Hosting web bundle');
  assert.ok(check>0 && exportAndroid>check && exportWeb>exportAndroid);
  assert.match(workflow,/fix\/admob-fill-funnel-finance-evidence-gates-20261111/);
  assert.match(workflow,/git rev-parse HEAD/);
  assert.match(read('scripts/verify-production-ads-env.cjs'),/EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS/);
});

test('Permanent ad and finance diagnostic test is mandatory at PR, RC, and OTA gates',()=>{
 const path='node --test tests/buklod-admob-fill-finance-release-20261111.test.mjs';
 for(const name of ['engineering-accountability.yml','unified_rc_compiled_qa_20261108.yml','production_android_ota.yml']){
   const workflow=read('.github/workflows/'+name);
   assert.ok(workflow.includes(path),name);
 }
});
