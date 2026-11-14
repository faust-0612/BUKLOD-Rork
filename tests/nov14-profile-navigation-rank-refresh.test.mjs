import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('canonical overall/monthly Profile ranks revalidate on each tab focus with stale response protection',()=>{
 const me=read('src/app/(tabs)/me.tsx');
 const rankStart=me.indexOf('const [rankPositions');
 const slice=me.slice(rankStart,me.indexOf('  useEffect(() => {',rankStart));
 assert.match(slice,/useProfileFocusEffect\(/);
 assert.match(slice,/useProfileFocusCallback\(/);
 assert.match(slice,/loadBuklodPointsDashboard\(\)/);
 assert.match(slice,/value\.all_time_rank/);
 assert.match(slice,/value\.monthly_rank/);
 assert.match(slice,/if \(active\)/);
 assert.match(slice,/return \(\) => \{ active = false; \}/);
 assert.doesNotMatch(slice,/useEffect\(/);
 assert.match(me,/AdMob payouts finalize separately/);
});
test('only authenticated owner recent posts refresh when Profile regains focus',()=>{
 const posts=read('src/components/BuklodProfilePostCards.tsx');
 assert.match(posts,/useFocusEffect\(useCallback\(/);
 assert.match(posts,/loadMemberCommunityPosts\(userId,userId,3\)/);
 assert.match(posts,/if\(active\)setPosts\(rows\)/);
 assert.match(posts,/return \(\)=>\{active=false;\}/);
 assert.match(posts,/router\.push\(\('\/post\/'/);
 assert.match(posts,/MY RECENT POSTS/);
 assert.doesNotMatch(posts,/useEffect\(/);
});

test('all-time and monthly ranks appear on official and ordinary Profile ahead of posts and sponsored content',()=>{
 const me=read('src/app/(tabs)/me.tsx');
 const rank=me.indexOf('MY OVERALL & MONTHLY RANK');
 const official=me.indexOf('isBuklodOfficial && !!profile?.id && <BuklodProfilePostCards');
 assert.ok(rank>0 && official>rank,'rank must not be hidden behind the official bulletin');
 assert.ok(me.includes("['ALL-TIME',rankPositions?.overall]"));
 assert.ok(me.includes("['MONTHLY',rankPositions?.monthly]"));
 assert.equal(me.split('MY OVERALL & MONTHLY RANK').length-1,1,'no duplicated rank card');
 assert.ok(!me.includes('!isBuklodOfficial && <View style={{marginHorizontal:12,padding:12'),'official account must not be gated out');
 assert.match(me,/AdMob payouts finalize separately/);
});
