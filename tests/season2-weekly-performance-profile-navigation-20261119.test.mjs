import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Profile navigation retains existing avatar tap behavior while class panel is expandable and own-account only',()=>{
 const me=read('src/app/(tabs)/me.tsx');
 const card=read('src/components/season2/BuklodWeeklyPerformanceCard.tsx');
 const avatar=read('src/components/BuklodTappableAvatar.tsx');
 const connect=read('src/components/connect/ConnectTappableAvatar.tsx');
 const connectWeb=read('src/components/connect/ConnectTappableAvatar.web.tsx');
 assert.match(me,/onPress=\{\(\) => \{\s*if \(!avatarBusy\)/);
 assert.match(me,/BuklodWeeklyPerformanceCard userId=\{profile\?\.id\}/);
 assert.match(card,/onPress=\{\(\)=>setExpanded\(v=>!v\)\}/);
 assert.match(card,/viewerId!==ownerId/);
 assert.match(card,/S2_WEEKLY_PERFORMANCE_STAGING_ONLY/);
 assert.match(card,/if\(!current\)return null/,'Missing isolated backend must hide the incomplete Profile UI');
 assert.match(avatar,/visitMemberProfile/);
 assert.match(avatar,/isAvatarCircleHit/);
 assert.match(connect,/isAvatarCircleHit/);
 assert.match(connectWeb,/tryOpenBuklodDesktopDock/);
});
test('Avatar 2 oclock icon is decorative to protect navigation; Notes content stays and online/Rank badges remain untouched',()=>{
 const source=read('src/components/ProfileAvatar.tsx');
 const active=source.split('export function ProfileAvatarStatusIndicator')[1].split('/** Readable avatar-adjacent')[0];
 assert.match(active,/pointerEvents="none"/);
 assert.match(active,/right:-px\*0\.22/);
 assert.match(active,/top:-px\*0\.22/);
 assert.match(active,/manilaWeekStart\(\)/);
 assert.doesNotMatch(active,/readQuickNote/);
 assert.doesNotMatch(active,/>\s*N\s*</);
 assert.match(source,/export function ProfileAvatarNoteChip/);
 assert.match(source,/getBuklodCircleRankArt/);
 assert.match(source,/backgroundColor:\s*'#00AAFF'/);
});
