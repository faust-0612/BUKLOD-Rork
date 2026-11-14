import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('consolidated staging source retains protected video and ad feature proofs',()=>{
 const wf=read('.github/workflows/engineering-accountability.yml');
 const m=JSON.parse(read('.buklod/scopes/nov15-consolidated-video-ad-staging.json'));
 assert.ok(wf.includes('node scripts/protected-feature-lock.mjs'));
 assert.ok(wf.includes('node --test tests/protected-feature-lock.test.mjs'));
 assert.ok(wf.includes('node scripts/engineering-regression-gate.mjs --run-focused-node-tests'));
 assert.equal(m.contractVersion,2);
 assert.equal(m.baseRef,'integration/buklod-conso-staging-no-hc-saliksik-20261114');
 const ids=m.lockedFeatureChanges.map(x=>x.id);
 for(const id of ['app-runtime','wall-media','navigation-auth','ads-finance-points','cluster-faith']) assert.ok(ids.includes(id),id);
 for(const path of ['src/components/BuklodCommunityInlineAd.android.tsx','src/components/BuklodCommunityInlineAd.tsx','src/app/(tabs)/buklod.tsx','src/lib/buklodVideoScrollSignal.ts']) assert.ok(m.allowedPaths.includes(path),path);
 for(const path of ['tests/nov14-video-scroll-stop-native-prefetch.test.mjs','tests/ad-native-lifecycle-retention-20261115.test.mjs']) assert.ok(m.regressionTests.includes(path),path);
});
