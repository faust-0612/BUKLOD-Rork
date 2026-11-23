import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Wall GIF entry opens only the local picker; media remains governed by existing publishing path', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const picker = read('src/components/BuklodCommunityGifPicker.tsx');
  assert.match(wall, /accessibilityLabel="Browse GIF library for Community post"/);
  assert.match(wall, /onPress=\{\(\)=>setCommunityGifPickerOpen\(true\)\}/);
  assert.match(wall, /onPick=\{file=>\{/);
  assert.match(wall, /setCommunityGif\(file\)/);
  assert.match(wall, /setPhotos\(\[\]\)/);
  assert.match(wall, /setWallVideo186O\(null\)/);
  assert.match(wall, /await uploadCommunityGifFile\(/);
  assert.doesNotMatch(picker, /supabase\.rpc|router\.push|enqueueCommunityPublish/);
});

test('Scoped community chooser never posts to another scope or bypasses scoped upload', () => {
  const scope = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  assert.match(scope, /accessibilityLabel="Browse GIF library for this community"/);
  assert.match(scope, /mode === 'wall' \? \(/);
  assert.match(scope, /onPress=\{\(\) => setCommunityGifPickerOpen\(true\)\}/);
  assert.match(scope, /clearMedia\(\);\s*setCommunityGif\(file\);/);
  assert.match(scope, /scope\/\$\{scope\.scope_id\}\/\$\{user\.id\}/);
  assert.match(scope, /buklod_scope_social_add_comment_v1/);
});

test('Comment GIF selection is preview-only and manual Send remains the only submit action', () => {
  const comment = read('src/components/BuklodCommunityCommentComposer.tsx');
  const picker = read('src/components/BuklodCommunityGifPicker.tsx');
  assert.match(comment, /onPickRemote=\{pickGif\}/);
  assert.match(comment, /onMediaChange\(\{ kind: 'gif', ref: url \}, url\)/);
  assert.match(comment, /onMediaChange\(\{ kind: 'gif', ref: file\.uri \}, file\.uri\)/);
  assert.match(comment, /onPress=\{onSend\}/);
  assert.match(picker, /if \(onPickRemote\) \{ onPickRemote\(item\); close\(\); return; \}/);
});

test('Connect GIF path and selected GIF message send remain intact; ads untouched', () => {
  const thread = read('src/components/BuklodConnectThread.tsx');
  const catalog = read('src/lib/buklodConnectGifCatalog.ts');
  const wall = read('src/app/(tabs)/buklod.tsx');
  const scope = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  assert.match(thread, /downloadConnectCatalogGif/);
  assert.match(thread, /sendConnectGifFile\(picked\)/);
  assert.match(thread, /onSendGif=\{gifId => \{/);
  assert.match(catalog, /EXPO_PUBLIC_GIPHY_ANDROID_API_KEY/);
  assert.match(catalog, /rating: 'g'/);
  assert.match(wall, /warmBuklodAdOpportunity/);
  assert.match(scope, /warmBuklodAdOpportunity/);
});
