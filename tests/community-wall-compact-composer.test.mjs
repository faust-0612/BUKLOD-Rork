import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const get=path=>readFileSync(new URL('../'+path, import.meta.url),'utf8');
const pub=get('src/app/(tabs)/buklod.tsx');
const scoped=get('src/components/BuklodExclusiveScopeCommunity.tsx');
test('Public empty composer is a compact one-tap bar with a real photo action',()=>{
 assert.match(pub,/communityComposerOpen, setCommunityComposerOpen/);
 assert.match(pub,/composerIntent === 'post' && !body\.trim\(\)/);
 assert.match(pub,/accessibilityLabel="Write a Community post"/);
 assert.match(pub,/setCommunityComposerOpen\(true\)/);
 assert.match(pub,/composerInputRef\.current\?\.focus/);
 assert.match(pub,/accessibilityLabel="Add photos or video to Community post"/);
 assert.match(pub,/void pickWallGallery186O\(\)/);
 assert.match(pub,/<BuklodMentionField/);
 assert.match(pub,/onPress=\{publish\}/);
});
test('Scoped empty Wall uses the same quick bar; Reels and draft editor stay canonical',()=>{
 assert.match(scoped,/wallComposerOpen, setWallComposerOpen/);
 assert.match(scoped,/mode === 'wall' && !wallComposerOpen && !body\.trim\(\)/);
 assert.match(scoped,/accessibilityLabel="Write a post to this community"/);
 assert.match(scoped,/setWallComposerOpen\(true\)/);
 assert.match(scoped,/accessibilityLabel="Add photos or video to scoped community post"/);
 assert.match(scoped,/void chooseGallery\(\)/);
 assert.match(scoped,/<BuklodMentionField/);
 assert.match(scoped,/void publish\(\)/);
});
