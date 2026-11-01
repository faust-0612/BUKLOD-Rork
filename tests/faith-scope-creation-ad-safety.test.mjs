import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(name, 'utf8');

test('Scoped bulletin is committed before a safe ad transition', () => {
 const s=read('src/app/scope/bulletin-editor.tsx');
 assert.match(s,/BuklodSubmissionAdSlot placementId="scope_bulletin_before_publish"/);
 const insert=s.indexOf(".from('buklod_scope_bulletins')");
 const success=s.indexOf("setFeedback({ kind: 'info', text: 'Bulletin published.' })");
 const ad=s.indexOf("await showBuklodAdOpportunity('bulletin_published_success')");
 assert.ok(insert>=0 && success>insert && ad>success);
 assert.ok(s.indexOf('router.back();',ad)>ad);
});

test('Community creator supports all post types through a shared, keyboard-aware slot', () => {
 const s=read('src/app/community/create.tsx');
 assert.match(s,/BuklodSubmissionAdSlot placementId="community_post_before_publish"/);
 const created=s.indexOf("create_buklod_community_living_post_v2");
 const moderation=s.indexOf("queueBuklodCommunityModeration('root',postId)");
 const ad=s.indexOf("await showBuklodAdOpportunity('community_post_success')");
 const navigate=s.indexOf("router.replace('/(tabs)/buklod'as any)",ad);
 assert.ok(created>=0 && moderation>created && ad>moderation && navigate>ad);
});

test('Shared controller preserves spacing, route protections, and non-redeemable rewards',()=>{
 const ad=read('src/lib/buklodAdOpportunities.ts');
 const controller=read('src/lib/buklodGlobalAdController.ts');
 const slot=read('src/components/BuklodSubmissionAdSlot.tsx');
 for(const event of ['cluster_created_transition','organization_created_transition','community_post_success','bulletin_published_success']) assert.ok(ad.includes(event));
 assert.match(controller,/INTERSTITIAL_MIN_EVENT_COUNT/);
 assert.match(controller,/fullScreenCadenceCheckInFlight/);
 assert.doesNotMatch(controller,/fullScreenShownThisSession\s*</);
 assert.match(controller,/isBuklodAdRouteSensitive/);
 assert.match(slot,/keyboardVisible/);
 assert.doesNotMatch(ad,/grant.*points|cash.*reward|points_cash/i);
});
