
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(name)=>readFileSync(new URL('../'+name, import.meta.url),'utf8');
test('compact Home preserves authorized navigation, ads, QMP and focus lifetime',()=>{
 const home=source('src/app/(tabs)/hub.tsx');
 assert.match(home,/useFocusEffect/);
 assert.match(home,/<Contribution\s*\/>/);
 assert.match(home,/<BuklodFirstViewAd\b/);
 assert.match(home,/<BuklodNativeSponsoredCard\b/);
 assert.match(home,/<BuklodKingdomHubCard\s*\/>/);
 assert.match(home,/noteBuklodVideoScroll\(\)/);
 assert.match(home,/paddingTop: 8, paddingBottom: 20, gap: 8/);
 const profile=source('src/app/(tabs)/me.tsx');
 assert.match(profile,/theme\.onAccent/);
 assert.match(source('src/components/BuklodProfilePostCards.tsx'),/loadMemberCommunityPosts\(userId,userId,3\)/);
});
