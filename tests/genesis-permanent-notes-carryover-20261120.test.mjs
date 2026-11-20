import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const r=p=>readFileSync(p,'utf8');
test('Genesis Notes stay until owner removes them, no 24-hour local expiry',()=>{
 const m=r('src/lib/buklodMessagesStatusNote.ts'),s=r('src/app/profile/status.tsx');
 assert.match(m,/Boolean\(note\?\.quick_note\?\.trim\(\)\)/);
 assert.match(m,/expires_at: null/);
 assert.match(s,/quick_note_expires_at: null/);
 for(const p of ['src/components/BuklodCommunityWallProfileBubbles.tsx','src/components/BuklodCommunityConnectHeader.web.tsx']){
   const txt=r(p);
   assert.doesNotMatch(txt,/pruneExpiredContactNotes|hoursLeftLabel/);
   assert.match(txt,/rankName=\{contact\.rank_name\}/);
 }
});
test('No seasonal backend writes or rank overlays lost',()=>{
 const a=r('src/components/ProfileAvatar.tsx');
 assert.match(a,/EXPO_PUBLIC_BUKLOD_GENESIS_PRESENCE_APPROVED/);
 assert.match(a,/get_member_circle_ranks_v1/);
 assert.match(r('src/app/(tabs)/buklod.tsx'),/rankName=\{item\.author_rank_name\}/);
});
