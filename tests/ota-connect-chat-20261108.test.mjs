import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('comment reacts via visible emoji and long-press uses screen bounded modal',()=>{
 const bubble=read('src/components/BuklodCommunityCommentBubble.tsx');
 const action=read('src/components/BuklodReactionAction.tsx');
 assert.match(bubble,/onLongPress=\{\(\) => setReactionPickerOpen\(true\)\}/);
 assert.match(bubble,/reactionOptions\.find\(option => option\.key === comment\.my_reaction\)\?\.emoji/);
 assert.match(bubble,/showAction=\{false\}/);
 assert.match(bubble,/visible=\{reactionPickerOpen\}/);
 assert.match(action,/showAction\?: boolean/);
 assert.match(bubble,/onReactionSummaryPress=\{onReactionSummaryPress\}/);
});
test('scope messages remain complete but compact with preserved composer, calls and reader badges',()=>{
 const thread=read('src/components/BuklodConnectThread.tsx');
 const bubble=read('src/components/connect/ConnectMessageBubble.tsx');
 const header=read('src/components/connect/ConnectThreadHeader.tsx');
 assert.match(bubble,/marginBottom: 9/);
 assert.match(thread,/marginBottom: 11/);
 assert.match(thread,/ConnectMessageBubble/);
 assert.match(thread,/ConnectThreadHeader/);
 assert.match(thread,/ConnectComposer/);
 assert.match(thread,/seenReaders/);
 assert.match(header,/showDirectCalls/);
});
test('sponsored captions are expandable and video controls do not cover the creative',()=>{
 const ad=read('src/components/BuklodCommunitySponsoredAd.tsx');
 assert.match(ad,/captionExpanded/);
 assert.match(ad,/See more/);
 assert.match(ad,/nativeControls=\{false\}/);
 assert.match(ad,/style=\{s\.videoBar\}/);
 assert.match(ad,/paidSponsorshipCanDisplay/);
 assert.match(ad,/safeUrl && <Pressable accessibilityRole="link"/);
});
