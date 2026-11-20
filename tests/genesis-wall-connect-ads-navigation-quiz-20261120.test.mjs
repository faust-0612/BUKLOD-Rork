import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');
test('Wall and Connect shared avatar rank and tap flows are not clipped',()=>{
 const avatar=read('src/components/ProfileAvatar.tsx');
 const wall=read('src/app/(tabs)/buklod.tsx');
 const tap=read('src/components/BuklodTappableAvatar.tsx');
 const connect=read('src/components/connect/ConnectTappableAvatar.tsx');
 assert.match(avatar,/get_member_circle_ranks_v1/);
 assert.match(avatar,/rankPreviewEnabled \? getBuklodCircleRankArt/);
 assert.match(wall,/rankName=\{item\.author_rank_name\}/);
 assert.match(tap,/overflow: 'visible'/);
 assert.match(connect,/overflow: 'visible'/);
 assert.match(connect,/isAvatarCircleHit/);
});
test('Account-aware nav and permanent Connect note never silently expires',()=>{
 const note=read('src/lib/buklodMessagesStatusNote.ts');
 const profile=read('src/app/profile/status.tsx');
 const nav=read('src/lib/buklodNotificationNavigation.ts');
 assert.match(note,/Boolean\(note\?\.quick_note\?\.trim\(\)\)/);
 assert.match(profile,/quick_note_expires_at: null/);
 assert.match(nav,/admin_new_user/);
 assert.match(read('src/app/admin/new-users.tsx'),/<AdminGate>/);
});
test('Existing AdMob, points and reward authority remain unchanged; extra guide is read only',()=>{
 const rewards=read('src/components/points/BuklodS2CompleteRewardsReference.tsx');
 const route=read('src/app/points/season2-guide.tsx');
 const points=read('src/components/points/BuklodPointsRewardsScreen.tsx');
 assert.doesNotMatch(rewards,/supabase\.|claimBuklodRewardEvent\s*\(|\.rpc\(/);
 assert.match(route,/isGenesisPreviewBuild/);
 assert.match(points,/\/points\/season2-guide/);
 const scope=read('src/lib/season2/buklodSeason2ApprovedScopeR1.ts');
 for(const flag of ['productionAuthorized:false','backendRewardsLive:false','tokenMint:false','requiresNewOwnerApproval:true'])assert.ok(scope.includes(flag),flag);
 const a=read('src/components/ProfileAvatar.tsx');
 assert.match(a,/EXPO_PUBLIC_BUKLOD_GENESIS_PRESENCE_APPROVED === 'true'/);
});
test('Bible Quiz rubric remains read-only and server-issued',()=>{
 const quiz=read('src/components/bible/BuklodBibleQuizV4.tsx');
 assert.match(quiz,/rubric_guidance/);
 assert.match(quiz,/rubric_feedback/);
 assert.match(quiz,/\(supabase as any\)\.rpc/);
 assert.doesNotMatch(quiz,/wallet\.mint|tokenMint\s*\(/);
});
