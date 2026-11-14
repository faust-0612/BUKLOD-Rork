import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import {
  WALL_DRAFT_SCHEMA, MAX_SAVED_WALL_DRAFTS, MAX_WALL_DRAFT_TEXT,
  wallDraftSecureKey, normalizeWallTextDrafts
} from '../src/lib/buklodNavigationDraftPolicy.ts';

const path = id => id.toString(16).padStart(8,'0')+'-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const now = 2_000_000_000_000;
const record = (i, text='draft', savedAt=now-500) => ({postId:path(i),text,savedAt});
const envelope = drafts => ({schema:WALL_DRAFT_SCHEMA,drafts});
const read = p => fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('private Wall draft policy rejects invalid identity and is account-isolated', () => {
 const a=wallDraftSecureKey(path(1)),b=wallDraftSecureKey(path(2));
 assert.notEqual(a,b);
 assert.match(a,/comment-drafts\.v1/);
 assert.throws(()=>wallDraftSecureKey('not-an-account'));
 assert.deepEqual(normalizeWallTextDrafts({schema:'unexpected',drafts:[record(1)]},now),[]);
});
test('bounded text-only drafts expire, reject unsafe payloads and deduplicate', () => {
 const e=envelope([
  record(1,'First'),record(1,'duplicate'),record(2,' '.repeat(5)),
  record(3,'x'.repeat(MAX_WALL_DRAFT_TEXT+1)),
  record(4,'too old',now-13*60*60*1000),
  record(5,'future',now+1),...Array.from({length:12},(_,i)=>record(i+6))
 ]);
 const result=normalizeWallTextDrafts(e,now);
 assert.equal(result.length,MAX_SAVED_WALL_DRAFTS);
 assert.equal(result[0].text,'First');
 assert.equal(new Set(result.map(x=>x.postId)).size,result.length);
 assert.ok(result.every(x=>x.text.trim() && x.text.length<=MAX_WALL_DRAFT_TEXT));
});
test('wall component restores current-user text without overwriting new input, and clears confirmed sends', () => {
 const wall=read('src/app/(tabs)/buklod.tsx');
 const store=read('src/lib/buklodNavigationDraftRecovery.ts');
 assert.match(wall,/draftOwnerRef\.current===accountId/);
 assert.match(wall,/activeCommentPostIdRef\.current===postId/);
 assert.match(wall,/setCommentText\(current=>current\|\|restored\)/);
 assert.match(wall,/clearWallCommentTextDraft\(authorId,postId\)/);
 assert.match(wall,/draftOwnerRef\.current=null/);
 assert.match(store,/SecureStore\.getItemAsync/);
 assert.match(store,/SecureStore\.setItemAsync/);
 assert.match(store,/SecureStore\.deleteItemAsync/);
 assert.match(store,/function serialize/);
 assert.doesNotMatch(store,/\b(?:mediaUri|imageUri|gifUri|mimeType|mentionIds|replyTo)\s*:/i);
});
test('scoped Back and public comment sheet restoration preserve authorized navigation', () => {
 const scope=read('src/app/scope/index.tsx');
 assert.match(scope,/BackHandler\.addEventListener/);
 assert.match(scope,/section !== 'home'/);
 assert.match(scope,/exitScopedWorkspace/);
 const wall=read('src/app/(tabs)/buklod.tsx');
 assert.match(wall,/commentDraftsRef\.current/);
 assert.match(wall,/rememberActiveCommentGifTarget/);
 assert.match(wall,/forgetActiveCommentGifTarget/);
});
