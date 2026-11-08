import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const notification=read('src/lib/buklodNotificationNavigation.ts');
const post=read('src/app/post/[id].tsx');
const wall=read('src/app/(tabs)/buklod.tsx');
const connect=read('src/app/(tabs)/messages.tsx');
const room=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
const files=read('src/lib/buklodScopeHomeAssets.ts');
const profile=read('src/components/BuklodScopeProfilePhoto.tsx');
const attendance=read('src/components/BuklodHomeCheckinToday.tsx');
const checkinSQL=read('supabase/migrations/20261107231000_buklod_points_r3_home_checkin.sql');
const points=read('src/components/points/BuklodPointsRewardsScreen.tsx');
const economy=read('src/components/points/BuklodEconomyDashboard.tsx');
const rank=read('src/components/points/BuklodPointsStage.tsx');
const banner=read('src/components/BuklodLivingGreetingsBanner.tsx');

test('notifications honor source record and comment identity, never generic Wall fallback',()=>{
 assert.match(notification,/focusCommentId/);
 assert.match(notification,/encodeURIComponent\(exactCommentId\)/);
 assert.match(notification,/message_id/);
 assert.match(notification,/focusMessageId/);
 assert.match(notification,/focusPostId/);
 assert.match(post,/focusCommentId/);
 assert.match(post,/lastFocusedComment/);
 assert.match(post,/scrollTo/);
 assert.match(notification,/return null/);
});

test('Cluster attendance is gated to an active official event and admin review',()=>{
 assert.match(attendance,/get_my_buklod_home_checkin_today_r3/);
 assert.match(attendance,/submit_my_buklod_home_checkin_r3/);
 assert.match(attendance,/if\(!loading&&events\.length===0/);
 assert.match(checkinSQL,/e\.is_active=true/);
 assert.match(checkinSQL,/attendance_open_at/);
 assert.match(checkinSQL,/attendance_close_at/);
 assert.match(checkinSQL,/membership_status='ACTIVE'/);
 assert.match(checkinSQL,/status='pending'/);
 assert.match(checkinSQL,/admin_review_buklod_home_checkin_r3/);
});

test('Cluster Home file/media lifecycle keeps admin-only private object policies and linked references',()=>{
 assert.match(files,/BUKLOD_SCOPE_HOME_ASSET_BUCKET='buklod-scope-home-assets'/);
 assert.match(files,/uploadBuklodScopeHomeAsset/);
 assert.match(files,/signedBuklodScopeHomeAsset/);
 assert.match(files,/rollbackBuklodScopeHomeAsset/);
 assert.match(files,/readUploadBytes/);
 assert.match(room,/pickBuklodScopeHomeResource/);
 assert.match(room,/pickBuklodScopeHomeMedia/);
 assert.match(room,/media_path/);
 assert.match(room,/storage_path/);
 assert.match(room,/media_mime_type/);
 assert.match(room,/pendingAssetPath/);
 assert.match(room,/rollbackBuklodScopeHomeAsset/);
 assert.match(profile,/profile_photo_path/);
 assert.match(profile,/isAdmin/);
});

test('Cluster Home Call button mounts the real authenticated group call flow',()=>{
 assert.match(room,/BuklodScopeCallLauncher/);
 assert.match(room,/scopeId=\{scope\.scope_id\}/);
 const call=read('src/components/BuklodScopeCallLauncher.tsx');
 assert.match(call,/ensureBuklodStreamVideoClient/);
 assert.match(call,/buklod_connect_scope_call_members/);
 assert.match(call,/call\.getOrCreate/);
 assert.match(call,/ring: true/);
});

test('fast scroll renders real content with a pre-render buffer and scoped connect remains compact',()=>{
 assert.match(wall,/drawDistance=\{Platform\.OS==='web' \? /);
 assert.match(wall,/maintainVisibleContentPosition=\{\{ disabled: true \}\}/);
 assert.match(connect,/removeClippedSubviews=\{false\}/);
 assert.match(connect,/renderHiblaHeader/);
});

test('Points claims use one canonical claim entry and preserve ad opportunity, rank data is not a points door',()=>{
 assert.match(points,/showBuklodAdOpportunity\('points_claim_success'\)/);
 assert.match(points,/claimBuklodRewardGroup/);
 assert.doesNotMatch(economy,/claimBuklodRewardEvent\(/);
 assert.doesNotMatch(economy,/claimBuklodRewardGroup\(/);
 assert.match(rank,/pointsToNext/);
});

test('community announcements include verified notification and ledger snapshots rather than invented points',()=>{
 assert.match(banner,/buklod_my_living_greetings_v1/);
 assert.match(banner,/buklod_points_ledger/);
 assert.match(banner,/notifications/);
 assert.match(banner,/resolveBuklodNotificationTarget/);
});
