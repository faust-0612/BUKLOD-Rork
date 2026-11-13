import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const rd=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Profile presents actual own posts instead of only a navigation list',()=>{
 const me=rd('src/app/(tabs)/me.tsx'),cards=rd('src/components/BuklodProfilePostCards.tsx');
 assert.match(me,/<BuklodProfilePostCards userId=\{profile.id\}/);
 assert.match(cards,/loadMemberCommunityPosts\(userId,userId,3\)/);
 assert.match(cards,/post\.media_url/);assert.match(cards,/post\.body/);
 assert.match(cards,/Open exact post card/);
});
test('Locked member profile reveals only generic membership label',()=>{
 const ui=rd('src/app/member/[id].tsx'),lib=rd('src/lib/buklodMemberProfile.ts');
 assert.match(ui,/BUKLOD community member · Private profile/);
 assert.match(lib,/if \(locked && !isSelf\)/);
 assert.match(lib,/avatar_url: null/);
 assert.match(lib,/quick_note: null/);
 assert.match(lib,/Math\.min\(40, Math\.floor\(maxRows\)\)/);
});