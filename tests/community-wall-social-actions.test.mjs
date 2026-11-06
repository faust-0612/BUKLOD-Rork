import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');
const e=get('src/components/BuklodCommunityPostEngagement.tsx');
const s=get('src/components/BuklodPostInternalShare.tsx');
const pub=get('src/app/(tabs)/buklod.tsx');
const scope=get('src/components/BuklodExclusiveScopeCommunity.tsx');
test('Like Comment Share use one feed-specific row without forking reaction picker',()=>{
 assert.match(e,/showSummary=\{!socialActions\}/);
 assert.match(e,/selectedReaction\?\.label \?\? 'Like'/);
 assert.match(e,/socialActions \? 'Comment' : totalComments/);
 assert.match(e,/styles\.socialShare/);
 assert.match(e,/styles\.socialReactionIcon/);
 assert.match(e,/width: 46/);
 assert.match(e,/BuklodReactionAction/);
 assert.match(e,/onSelect=\{onReact\}/);
});
test('Public and scoped posts opt in, retaining backend share and comment handlers',()=>{
 assert.match(pub,/showCommentAction\s+socialActions\s+rightAction/);
 assert.match(scope,/showCommentAction\s+socialActions\s+rightAction=\{<BuklodPostInternalShare/);
 assert.match(scope,/renderPostOverflow\(item\)/);
 assert.match(s,/social \? 'Share' : iconOnly/);
 assert.match(s,/buklod_internal_share_post_v2/);
 assert.match(e,/onOpenComments/);
 assert.match(e,/onReactionSummaryPress\?\.\(option\.key\)/);
 assert.match(e,/onReport/);
});
