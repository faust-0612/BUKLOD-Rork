import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const me=read('src/app/(tabs)/me.tsx'),activity=read('src/components/BuklodProfileActivityCards.tsx'),posts=read('src/components/BuklodProfilePostCards.tsx');
test('Profile retains rank and 3 recent posts ahead of private activity and ads',()=>{
 assert.match(me,/MY OVERALL & MONTHLY RANK/);
 assert.match(me,/value\.all_time_rank/);assert.match(me,/value\.monthly_rank/);
 assert.match(me,/<BuklodProfilePostCards userId=\{profile\.id\} \/>/);
 assert.match(me,/<BuklodProfileActivityCards userId=\{profile\.id\} \/>/);
 assert.ok(me.indexOf('<BuklodProfilePostCards')<me.indexOf('<BuklodProfileActivityCards'));
 assert.ok(me.indexOf('<BuklodProfileActivityCards')<me.indexOf('<BuklodNativeSponsoredCard'));
 assert.match(posts,/loadMemberCommunityPosts\(userId,userId,3\)/);
 assert.match(me,/AdMob payouts finalize separately/);
});
test('private activity remains account-owned and bounded; no public or admin bypass',()=>{
 assert.match(activity,/viewerId!==userId/);
 assert.match(activity,/\.eq\('user_id',viewerId\)/);
 assert.match(activity,/\.eq\('direction','credit'\)/);
 assert.match(activity,/\.limit\(4\)/);
 assert.match(activity,/if\(!active\)return/);
 assert.match(activity,/return \(\)=>\{active=false;\}/);
 assert.doesNotMatch(activity,/service_role|SUPABASE_SERVICE_ROLE/);
});
test('actual report destinations are already-defined authenticated screens',()=>{
 for(const route of ['/bible/report','/faith/mentor-evidence','/scope-fund'])assert.ok(activity.includes(route));
 assert.match(activity,/MY ACTIVITY & REPORTS/);
 assert.match(activity,/Recorded Points are not cash earnings/);
 assert.doesNotMatch(me,/How Account Deletion Works|Pilot Checklist|BUKLOD Kingdom/);
});
