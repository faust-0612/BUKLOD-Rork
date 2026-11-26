import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const door=read('src/components/BuklodSaliksikDoor.tsx');
const lab=read('src/components/BuklodSaliksikResearchLab.tsx');
const screen=read('src/app/scope/saliksik.tsx');
const sql=read('supabase/migrations/20261124051000_saliksik_r4_auto_research_corpus.sql');
test('research is not mounted outside the existing opted-in Cluster Home door',()=>{
 assert.match(door,/scope\.scope_type!=='CLUSTER'/);
 assert.match(door,/!scope\.show_faith_content/);
 assert.match(door,/EXPO_PUBLIC_SALIKSIK_ENABLED!=='true'/);
 assert.match(sql,/buklod_my_scopes_p0_v2/);
 assert.match(sql,/show_faith_content IS TRUE/);
 assert.match(screen,/<BuklodSaliksikResearchLab scopeId=\{scopeId\} onPublished=\{load\}/);
 assert.match(screen,/EXPO_PUBLIC_SALIKSIK_ENABLED!=='true'/);
});
test('no research/AI/Storage/Points work occurs during Cluster Home rendering',()=>{
 assert.doesNotMatch(door,/saliksikAutoAdvance|saliksikRequestResearch|saliksik_my_research_r4/);
 assert.doesNotMatch(lab,/buklod_points_ledger|createSignedUrl|SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(lab,/if\(busy\|\|question\.trim\(\)\.length<12\|\|!scopeId\)return;/);
 assert.match(lab,/if\(alive\.current\)await reload\(\)/);
});
