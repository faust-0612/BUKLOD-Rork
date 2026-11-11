import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('Public Wall comment scroll, keyboard, reply focus and modal navigation stay intact',()=>{
 const wall=read('src/app/(tabs)/buklod.tsx');
 const thread=read('src/components/BuklodCommunityCommentThread.tsx');
 assert.match(wall,/<KeyboardAvoidingView[\s\S]*?<ScrollView[\s\S]*?<BuklodCommunityCommentThread/);
 assert.match(wall,/keyboardShouldPersistTaps="handled"/);
 assert.match(wall,/onRequestClose=\{closeComments\}/);
 assert.match(thread,/onFocusedCommentLayout/);
 assert.match(thread,/React\.Fragment key=\{rootId\}/);
 assert.match(thread,/inlineAd && threadIndex === \(threads\.length === 1 \? 0 : 1\)/);
});
