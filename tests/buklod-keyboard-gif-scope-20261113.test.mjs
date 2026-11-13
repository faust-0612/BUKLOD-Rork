import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const wall = read('src/app/(tabs)/buklod.tsx');
const scoped = read('src/components/BuklodExclusiveScopeCommunity.tsx');
const handoff = read('src/app/handle-share.tsx');
const target = read('src/lib/buklodCommentGifTarget.ts');
const routes = read('src/lib/buklodRouteDiagnostics.ts');
test('Android keyboard GIF restores the same Cluster/Organization comment',()=>{
 assert.match(handoff,/getActiveCommentGifContext/);
 assert.match(handoff,/target\?\.scopeId/);
 assert.match(handoff,/scopeId: target\.scopeId/);
 assert.match(handoff,/focusPostId: target\.postId/);
 assert.match(scoped,/useBuklodIncomingShare/);
 assert.match(scoped,/await stageSharedCommentGif/);
 assert.match(scoped,/loadBuklodNotificationPost/);
 assert.match(scoped,/openComments\(post as SocialPost\)/);
 assert.match(scoped,/setCommentMediaPreview\(pending\.uri\)/);
 assert.match(scoped,/onSend=\{\(\) => void addComment\(\)\}/);
});
test('Public Wall cannot consume a scoped GIF while its tab is mounted',()=>{
 assert.match(wall,/activeShareRoute187A !== '\/buklod'/);
 assert.match(wall,/getActiveCommentGifTarget\(accountId\)/);
 assert.match(target,/return target && !target\.scopeId \? target\.postId : null/);
 assert.match(scoped,/activeSharePath !== '\/scope'/);
 assert.match(scoped,/target\.scopeId !== scope\.scope_id/);
 assert.match(scoped,/String\(post\.scope_id\) !== String\(scope\.scope_id\)/);
 assert.match(target,/target\.scopeId === \(scopeId\?\.trim\(\) \|\| null\)/);
});
test('Existing scoped upload, reply and RPC survive keyboard handoff',()=>{
 assert.match(scoped,/scope\/\$\{scope\.scope_id\}\/\$\{user\.id\}\/comment-gif-/);
 assert.match(scoped,/buklod_scope_social_add_comment_v1/);
 assert.match(scoped,/p_parent_id: originalReply/);
 assert.match(scoped,/discardStagedSharedCommentGif\(originalMedia\.ref\)/);
 assert.doesNotMatch(scoped,/Alert\.alert\('GIF ready for comment'/);
});
test('Render route is classified as handle-share, no dynamic identifiers',()=>{
 assert.match(routes,/'handle-share'/);
 assert.match(routes,/SAFE_SEGMENTS\.has\(part\.toLowerCase\(\)\) \? part\.toLowerCase\(\) : ':id'/);
});
