import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const wall=read('src/app/(tabs)/buklod.tsx');
const scoped=read('src/components/BuklodExclusiveScopeCommunity.tsx');
const selector=read('src/lib/buklodPublicWallScopeIdentity.ts');
const migration=read('supabase/migrations/20261120142500_buklod_public_wall_post_as_scope_identity_v1.sql');

test('public wall has opt-in scope identity without replacing the ordinary personal posting RPC',()=>{
 assert.match(wall,/selectedPostAsScopeId/);
 assert.match(wall,/eligiblePublicWallPostScopes/);
 assert.match(wall,/Post to Public Wall|POST TO PUBLIC WALL AS/);
 assert.match(wall,/create_buklod_public_wall_scope_post_v1/);
 assert.match(wall,/'create_buklod_community_post_v3'/);
 assert.match(wall,/setSelectedPostAsScopeId\(null\)/);
});
test('scope-only destination stays default and public publishing is explicit',()=>{
 assert.match(scoped,/useState\(false\).*?postToPublic|postToPublic.*?useState\(false\)/s);
 assert.match(scoped,/setPostToPublic\(false\)/);
 assert.match(scoped,/accessibilityLabel=\{'Post to Public Wall as '/);
 assert.match(scoped,/snapshot\.postToPublic\s*\? 'create_buklod_public_wall_scope_post_v1'/);
 assert.match(scoped,/snapshot\.postToPublic\s*\? snapshot\.userId :/);
 assert.match(scoped,/'buklod_scope_social_create_post_v1'/);
 assert.match(scoped,/!snapshot\.postToPublic\)await load\(\)/);
});
test('public feed primary identity is scope; only non-admin member receives a small byline',()=>{
 assert.match(wall,/public_scope_identity\.scope_name/);
 assert.match(wall,/!item\.public_scope_identity\.hide_author_name/);
 assert.match(wall,/Posted by/);
 assert.match(wall,/item\.public_scope_identity\.hide_author_name\?' · Official'/);
 assert.match(wall,/!item\.public_scope_identity\?\.hide_author_name/);
 assert.match(wall,/scopeIdentityPromise\.then/);
 assert.match(selector,/membership_status === 'ACTIVE'/);
 assert.match(selector,/\['LOCAL', 'CLUSTER', 'ORGANIZATION'\]/);
});
test('database records actual author securely; no private scope wall publication or role spoofing',()=>{
 assert.match(migration,/m\.user_id = actor/);
 assert.match(migration,/m\.membership_status = 'ACTIVE'/);
 assert.match(migration,/public\.buklod_is_scope_admin\(p_scope_id\)/);
 assert.match(migration,/public\.create_buklod_community_post_v3\(/);
 assert.match(migration,/'public', null, p_category/);
 assert.match(migration,/p\.audience = 'public' and p\.scope_id is null/);
 assert.match(migration,/a\.hide_author_name/);
 assert.match(migration,/alter table public\.buklod_public_wall_scope_identity enable row level security/);
 assert.match(migration,/revoke all on table public\.buklod_public_wall_scope_identity from public, anon, authenticated/);
 assert.doesNotMatch(migration,/update\s+public\.community_posts\s+set\s+audience\s*=\s*'public'/i);
});

test('public feed resolves scope identity at first paint with backwards compatibility',()=>{
 assert.match(wall,/get_buklod_public_community_feed_v8_page/);
 assert.match(wall,/initial\.error\?\.code==='PGRST202'/);
 assert.match(wall,/get_buklod_public_community_feed_v7_page/);
 assert.match(wall,/Object\.prototype\.hasOwnProperty\.call\(post,'public_scope_identity'\)/);
 assert.match(migration,/create or replace function public\.get_buklod_public_community_feed_v8_page/);
 assert.match(migration,/from public\.get_buklod_public_community_feed_v7_page/);
 assert.match(migration,/grant execute on function public\.get_buklod_public_community_feed_v8_page/);
});
