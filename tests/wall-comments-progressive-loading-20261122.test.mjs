import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const wall=readFileSync(new URL('../src/app/(tabs)/buklod.tsx',import.meta.url),'utf8');
const loader=wall.slice(wall.indexOf('const loadComments='),wall.indexOf('const openComments='));

test('comment text paints before optional reactions and metadata',()=>{
 const primary=loader.indexOf("'get_buklod_post_comments_v4'");
 const paint=loader.indexOf('setComments(baseRows)');
 const reactions=loader.indexOf("'get_buklod_comment_reactions_v1'");
 const clusters=loader.indexOf('getClusterLabels(');
 const names=loader.indexOf('hydratePersonNamesOnRows(');
 assert.ok(primary>=0 && paint>primary);
 assert.ok(reactions>paint && clusters>paint && names>paint);
 assert.doesNotMatch(loader,/Promise\.all\(\[\s*communityReadRpc\('get_buklod_post_comments_v4'/);
 assert.match(loader,/if\(!rows\.length\)return/);
});
test('warm comments have account/post isolation and bounded memory',()=>{
 assert.match(wall,/const commentWarmCacheRef=useRef\(new Map/);
 assert.match(wall,/commentWarmCacheRef\.current\.clear\(\)/);
 assert.match(loader,/const cacheKey=requestAccountId\+':'\+targetId/);
 assert.match(loader,/Date\.now\(\)-cached\.savedAt<15000/);
 assert.match(loader,/commentWarmCacheRef\.current\.size>6/);
 assert.match(wall,/commentWarmCacheRef\.current\.delete\(authorId\+':'\+postId\)/);
});
test('stale responses cannot alter another post, account or optimistic reaction',()=>{
 assert.match(loader,/requestId===commentLoadSeqRef\.current/);
 assert.match(loader,/activeCommentPostIdRef\.current===targetId/);
 assert.match(loader,/commentAccountIdRef\.current===requestAccountId/);
 assert.match(loader,/reactionChangeAtStart!==commentReactionChangeSeqRef\.current/);
 assert.match(wall,/\+\+commentReactionChangeSeqRef\.current;[\s\S]*?setComments\(/);
 assert.match(loader,/if\(!isCurrent\(\)\)return/);
});
test('explicit authorization denial purges stale content',()=>{
 assert.match(loader,/category==='AUTH_ERROR'/);
 assert.match(loader,/commentWarmCacheRef\.current\.delete\(cacheKey\)/);
 assert.match(loader,/if\(accessRevoked\)\{[\s\S]*?setComments\(\[\]\)/);
});
test('nonessential failures never suppress comment text or display false zero',()=>{
 assert.match(loader,/if\(!isCurrent\(\) \|\| result\.error/);
 assert.match(loader,/setComments\(baseRows\)/);
 assert.match(loader,/setCommentLoadError\(/);
 assert.match(wall,/commentLoadError&&!comments\.length\?'—'/);
});
