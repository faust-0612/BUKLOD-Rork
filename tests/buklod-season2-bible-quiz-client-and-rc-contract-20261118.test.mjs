import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Main Bible V4 automatic learner rubric is visible, without manual approval',()=>{
 const learner=read('src/components/bible/BuklodBibleQuizV4.tsx');
 const admin=read('src/app/admin/bible-v4-events.tsx');
 for(const marker of ['rubric_guidance','rubric_feedback','get_my_buklod_bible_quiz_v4_review_details',
   'get_my_buklod_bible_quiz_v4','onLegacy'])assert.ok(learner.includes(marker),marker);
 assert.match(learner,/rubric_feedback\.message/);
 assert.match(learner,/criteria_matched/);
 assert.match(learner,/Awtomatikong/);
 assert.doesNotMatch(admin,/admin_review_buklod_bible_v4_essay|admin_list_buklod_bible_v4_pending/);
});
test('Main Bible V4 keeps proper authenticated RPC fallback and account-scoped draft keys',()=>{
 const s=read('src/components/bible/BuklodBibleQuizV4.tsx');
 assert.match(s,/@buklod-bible-v4:/);
 assert.match(s,/user\.id/);
 assert.match(s,/PGRST202/);
 assert.match(s,/submit_my_buklod_bible_quiz_v4/);
 assert.match(s,/showBuklodAdOpportunity/);
});
test('Current consolidated RC media, instant tabs, connect and AdMob contracts are retained',()=>{
 const must=[
  'src/components/BuklodAndroidDashboardTabs.tsx',
  'src/lib/communityVideoHandoff.ts',
  'src/lib/buklodVideoDiscovery.ts',
  'src/components/BuklodFlyingVideoReactions.tsx',
  'src/components/CommunityVideo.tsx',
  'src/components/BuklodConnectThread.tsx',
  'src/providers/AuthProvider.tsx',
 ];
 for(const p of must)assert.ok(read(p).length>200,p);
 const points=read('src/components/points/BuklodPointsRewardsScreen.tsx');
 assert.match(points,/BuklodSeasonJourneyPreview/);
 assert.match(points,/BuklodKingdomAdSlot/);
 assert.match(points,/points_redeem_transition_native/);
 const d=read('src/lib/buklodSeason2CampaignR1.ts');
 assert.match(d,/missionAwardsLive:false/);
 assert.match(d,/officialOpeningPublished:false/);
});
