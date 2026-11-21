import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/features/season2/world/Season2DevelopmentMap.tsx',import.meta.url),'utf8');
test('My Community is a verified scope preview, never the global Wall',()=>{
 assert.match(src,/communityScopes=scopes\.filter/);
 assert.match(src,/scope_type==='CLUSTER'\|\|s\.scope_type==='ORGANIZATION'/);
 assert.match(src,/chosenScope\?\.scope_id/);
 assert.match(src,/scope\.is_admin/);
 assert.match(src,/separate from the Public Community Wall/);
});
test('Community customization is locally isolated per user and chosen verified scope',()=>{
 assert.match(src,/ownerId/);
 assert.match(src,/world\+'\.'\+\(world==='home'\?'personal':chosenScope\?\.scope_id\?\?'unassigned'\)/);
 assert.match(src,/if\(!canCustomizePreview\)return/);
 assert.match(src,/setLook\('stone'\)/);
 assert.match(src,/AsyncStorage\.setItem\(storageKey,next\)/);
 assert.doesNotMatch(src,/supabase\.rpc|mintBp|awardBp|withdrawQMP/);
});
