import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('canonical overall/monthly ranks refresh silently on stale focus while preserving account boundaries',()=>{
 const me=read('src/app/(tabs)/me.tsx');
 const rankStart=me.indexOf('const [rankPositions');
 const focusStart=me.indexOf('  useProfileFocusEffect(',rankStart);
 const focusEnd=me.indexOf('\n\n  useEffect(',focusStart);
 assert.ok(rankStart>0 && focusStart>rankStart && focusEnd>focusStart);
 const slice=me.slice(focusStart,focusEnd);
 assert.match(slice,/useProfileFocusEffect\(/);
 assert.match(slice,/useProfileFocusCallback\(/);
 assert.match(slice,/loadBuklodPointsDashboard\(\)/);
 assert.match(slice,/value\.all_time_rank/);
 assert.match(slice,/value\.monthly_rank/);
 assert.match(slice,/if \(active\)/);
 assert.match(slice,/return \(\) => \{ active = false; \}/);
 assert.match(slice,/last\.owner === profile\.id && Date\.now\(\) - last\.at < 5_000/);
 assert.match(slice,/rankOwnerRef\.current = profile\.id/);
 assert.doesNotMatch(slice,/setRankPositions\(null\)/,'focus must never blank a warm rank');
 assert.match(me,/Points standings, not payout amounts\. Monthly ranks follow the calendar month\./);
});
test('only authenticated owner post previews refresh silently when Profile focus changes',()=>{
 const posts=read('src/components/BuklodProfilePostCards.tsx');
 assert.match(posts,/useFocusEffect\(useCallback\(/);
 assert.match(posts,/loadMemberCommunityPosts\(userId,userId,3\)/);
 assert.match(posts,/if\(active && ownerRef\.current===userId\)/);
 assert.match(posts,/setPosts\(rows\)/);
 assert.match(posts,/lastSyncRef\.current=Date\.now\(\)/);
 assert.match(posts,/const visiblePosts=ownerRef\.current===userId\?posts:\[\]/);
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
 assert.match(me,/Points standings, not payout amounts\. Monthly ranks follow the calendar month\./);
});

test('Profile shows canonical 1-10 Monthly and All-Time rankings, not only a hash rank badge',()=>{
 const me=read('src/app/(tabs)/me.tsx');
 const component=read('src/components/BuklodProfileTopTenRankings.tsx');
 assert.match(me,/import BuklodProfileTopTenRankings from/);
 assert.ok(me.includes('<BuklodProfileTopTenRankings userId={profile.id} />'));
 assert.ok(me.indexOf('MY OVERALL & MONTHLY RANK')<me.indexOf('<BuklodProfileTopTenRankings'));
 assert.ok(me.indexOf('isBuklodOfficial && !!profile?.id && <BuklodProfilePostCards')<me.indexOf('isBuklodOfficial && !!profile?.id && <BuklodProfileTopTenRankings'));
 assert.ok(me.indexOf('!isBuklodOfficial && !!profile?.id && <BuklodProfileActivityCards')<me.indexOf('!isBuklodOfficial && !!profile?.id && <BuklodProfileTopTenRankings'));
 assert.equal(me.split('<BuklodProfileTopTenRankings userId={profile.id} />').length-1,2,'mutually exclusive member/official rank lists');
 assert.ok(me.includes("{position&&position>0?String(position):'—'}"));
 assert.ok(component.includes('TOP 10 RANKINGS'));
 assert.ok(component.includes('item.rank_position'));
 assert.ok(component.includes("(['monthly', 'all_time'] as const)"));
});
