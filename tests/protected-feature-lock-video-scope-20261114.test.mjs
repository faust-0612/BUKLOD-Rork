import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('exact DEV branch has protected V2 manifest and video feature test proofs',()=>{
 const wf=read('.github/workflows/engineering-accountability.yml');
 const m=JSON.parse(read('.buklod/scopes/nov14-video-scroll-pause-ad-prewarm.json'));
 assert.ok(wf.includes('dev/video-scroll-pause-ad-prewarm-20261114)'));
 assert.ok(wf.includes('BUKLOD_SCOPE_MANIFEST=.buklod/scopes/nov14-video-scroll-pause-ad-prewarm.json'));
 assert.equal(m.contractVersion,2);
 assert.equal(m.baseRef,'7ebbbd504df2f84355888cc64a8c5317319d6d65');
 const ids=m.lockedFeatureChanges.map(x=>x.id);
 for(const id of ['app-runtime','wall-media','navigation-auth','ads-finance-points','cluster-faith','governance-lock']) assert.ok(ids.includes(id),id);
 assert.ok(m.allowedPaths.includes('.github/workflows/engineering-accountability.yml'));
 assert.ok(m.allowedPaths.includes('src/components/BuklodCommunityInlineAd.tsx'));
});
