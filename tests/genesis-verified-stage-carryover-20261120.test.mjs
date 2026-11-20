import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import test from 'node:test';
const read=p=>readFileSync(p,'utf8');
test('Genesis adds exactly ten owner-approved READ ONLY exclusives without reward activation',()=>{
 const lib=read('src/lib/season2/buklodSeason2ApprovedScopeR1.ts');
 const ui=read('src/components/points/BuklodSeason2ApprovedExclusivePreview.tsx');
 const points=read('src/components/points/BuklodPointsRewardsScreen.tsx');
 assert.equal((lib.match(/Object.freeze\(\{id:/g)||[]).length,10);
 for(const token of ['productionAuthorized:false','backendRewardsLive:false','tokenMint:false','requiresNewOwnerApproval:true','return false'])assert.ok(lib.includes(token),token);
 assert.match(ui,/Preview/);
 assert.doesNotMatch(ui,/supabase|claimBuklodRewardEvent/);
 assert.match(points,/isGenesisPreviewBuild\(\) \? <BuklodSeason2ApprovedExclusivePreview/);
});
test('KL expanded glossary only exposes terms mentioned in an accessible manuscript',()=>{
 const dict=read('src/lib/kabihasnang-ligaw/dictionary.ts');
 const reader=read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
 assert.ok(existsSync('src/lib/kabihasnang-ligaw/dictionaryExtras.ts'));
 assert.match(dict,/BASE_KL_DICTIONARY\.includes\(entry\) \|\| mentioned\.has\(entry\.name\)/);
 assert.match(reader,/dictionaryForManuscript\(reading\.text \?\? ''\)/);
});
