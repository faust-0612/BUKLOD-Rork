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
