import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const m=JSON.parse(read('.buklod/scopes/nov15-consolidated-video-ad-production.json'));

test('production RC preserves current main baseline and exact source parity requirement',()=>{
  assert.equal(m.baseRef,'main');
  assert.equal(m.contractVersion,2);
  assert.match(m.productionBaselineEvidence,/7ebbbd504df2f84355888cc64a8c5317319d6d65/);
  assert.match(m.productionBaselineEvidence,/74645fa89be1a40334f1725103ecd58cdc191230/);
  assert.ok(m.acceptanceChecks.some(x=>/14 video\/ad blobs/.test(x)));
  assert.ok(m.allowedPaths.includes('.github/workflows/buklod-nov15-prod-android-rc-qa.yml'));
  assert.ok(m.allowedPaths.every(p=>!p.startsWith('supabase/')&&!p.startsWith('android/')&&!p.startsWith('ios/')));
});

test('production NativeAd remains real-impression and actual-viewport gated',()=>{
 const src=read('src/components/BuklodCommunityInlineAd.android.tsx');
 assert.ok(src.includes('const canPrefetchNative'));
 assert.ok(src.includes('NativeAdEventType.IMPRESSION'));
 assert.ok(src.includes('if (nativeAd && !nativeFailed && canShowNativeCreative)'));
 assert.ok(src.includes('reserveBuklodPassiveAdRequest(placementId, requestKey)'));
 assert.match(src,/createdAd\?\.destroy\(\)/);
});

test('production promotion is prohibited before staging real receipt and keeps native IDs',()=>{
 const wf=read('.github/workflows/buklod-nov15-prod-android-rc-qa.yml');
 for(const anchor of ['BUKLOD Nov15 Production RC Android Source QA - No Publish', '74645fa89be1a40334f1725103ecd58cdc191230', 'npx tsc --noEmit', 'expo export --platform android', 'org.mzbministry.buklod', '1.3.2'])
   assert.ok(wf.includes(anchor),'Missing prod prerequisite '+anchor);
 assert.ok(!wf.includes('eas update --channel production'));
 assert.ok(!wf.includes('eas update --channel staging-user'));
});
