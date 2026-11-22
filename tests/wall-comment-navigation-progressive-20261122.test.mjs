import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wall=readFileSync(new URL('../src/app/(tabs)/buklod.tsx',import.meta.url),'utf8');
const load=wall.slice(wall.indexOf('const loadComments='),wall.indexOf('const openComments='));
const open=wall.slice(wall.indexOf('const openComments='),wall.indexOf('const closeComments='));

test('opening comment sheet keeps a post-scoped account and loads without feed navigation',()=>{
 assert.match(open,/activeCommentPostIdRef\.current=postId/);
 assert.match(open,/draftOwnerRef\.current=accountId/);
 assert.match(open,/setCommentOpen\(true\)/);
 assert.match(open,/loadComments\(String\(post\.id\)\)/);
 assert.match(wall,/accessibilityLabel="Retry loading comments"/);
});

test('identity switch, stale response and permission denial cannot reveal cached comments',()=>{
 assert.match(wall,/commentWarmCacheRef\.current\.clear\(\)/);
 assert.match(load,/commentAccountIdRef\.current===requestAccountId/);
 assert.match(load,/activeCommentPostIdRef\.current===targetId/);
 assert.match(load,/requestId===commentLoadSeqRef\.current/);
 assert.match(load,/if\(accessRevoked\)\{[\s\S]*?commentWarmCacheRef\.current\.delete\(cacheKey\);[\s\S]*?setComments\(\[\]\)/);
});

test('shared comment sheet retains protected ownership, reactions and paid placement',()=>{
 assert.match(load,/is_owner:row\.user_id===user\?\.id/);
 assert.match(wall,/set_buklod_comment_reaction_v1/);
 assert.match(wall,/public_wall_comments_engagement_inline/);
 assert.match(wall,/BuklodCommunityCommentThread/);
});
