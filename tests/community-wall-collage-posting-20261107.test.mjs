import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path,'utf8');
const collage = read('src/components/BuklodCommunityPhotoCollage.tsx');
const publicWall = read('src/app/(tabs)/buklod.tsx');
const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');

test('Three image layouts are available with correct hero geometry and bounded horizontal swipe',()=>{
  assert.match(collage, /CommunityPhotoCollageLayout = 'grid' \| 'highlight' \| 'swipe'/);
  assert.match(collage, /const LAYOUTS: readonly CommunityPhotoCollageLayout\[\] = \['grid', 'highlight', 'swipe'\]/);
  assert.match(collage, /if \(mode === 'highlight'\)/);
  assert.match(collage, /heroWidth = Math\.max\(1, Math\.round\(width \* 0\.62\)\)/);
  assert.match(collage, /if \(effectiveLayout === 'swipe'\)/);
  assert.match(collage, /<FlatList/);
  assert.match(collage, /initialNumToRender=\{1\}/);
  assert.match(collage, /maxToRenderPerBatch=\{2\}/);
  assert.match(collage, /windowSize=\{3\}/);
  assert.match(collage, /onMomentumScrollEnd=\{event => \{/);
  assert.match(collage, /onPressPhoto\?\.\(index, photos\)/);
});

test('Composer shows clear Grid, Highlight and Swipe choice; post presentation allows toggling',()=>{
  assert.match(collage, /showLayoutPicker = false/); // other consumers keep their UI
  assert.match(publicWall, /<BuklodCommunityPhotoCollage\s+showLayoutPicker/);
  assert.match(scopedWall, /<BuklodCommunityPhotoCollage\s+showLayoutPicker/);
  assert.match(publicWall, /<Text style=\{\[shared\.muted,\{fontSize:11,fontWeight:'800'\}\]\}>Collage layout<\/Text>/);
  assert.match(publicWall, /layoutMode=\{collageLayout\}/);
  assert.match(scopedWall, /layoutMode=\{collageLayout\}/);
  assert.match(publicWall, /rememberCommunityCollageLayout\(photoUploads\[0\]\.media_path, snapshot\.collageLayout\)/);
  assert.match(scopedWall, /rememberCommunityCollageLayout\(photoUploads\[0\]\.media_path, snapshot\.collageLayout\)/);
  assert.match(collage, /accessibilityLabel=\{`Choose photo collage layout\. Current: \$\{effectiveLayout\}`\}/);
  assert.match(collage, /rememberCommunityCollageLayout\(photoIdentity, value\)/);
  assert.match(collage, /setLayoutMenuOpen\(false\)/);
});

test('All layouts use the full original, canonical onPress and unchanged offline/signer path',()=>{
  assert.ok((collage.match(/useWallPreview=\{false\}/g) || []).length >= 3);
  assert.match(collage, /communityPhotoCollageItems\(items\)/);
  assert.match(collage, /dedupeCommunityPhotoItems/);
  assert.match(collage, /COMMUNITY_MAX_PHOTOS/);
  assert.match(publicWall, /renderCommunityMedia\(item\)/);
  assert.match(scopedWall, /<BuklodCommunityWallPostCard/);
  const android = read('src/components/BuklodCachedMediaImage.android.tsx');
  assert.match(android, /loadCachedCommunityWallPhoto\(/);
  assert.match(android, /pinLoadedCommunityWallPhoto\(/);
});
