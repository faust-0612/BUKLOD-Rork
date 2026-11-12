import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const picker = source('src/lib/buklodPickCommunityPhotos.ts');
const uploader = source('src/lib/uploadCommunityVideoFile.ts');
const composer = source('src/app/(tabs)/buklod.tsx');
const music = source('src/components/BuklodPostMusicPicker.tsx');
const timeline = source('src/components/BuklodMusicClipTimeline.tsx');
const ambiance = source('src/components/BuklodPostMotion.tsx');

test('gallery keeps immediate local preview metadata and avoids a second picker encode', () => {
  assert.match(picker, /quality: 1,/);
  assert.match(picker, /width: Number\(asset\.width/);
  assert.match(picker, /height: Number\(asset\.height/);
  assert.match(composer, /setPhotos\(current=>/);
  assert.match(composer, /mimeType:photo\.mimeType/);
  assert.match(composer, /width:photo\.width/);
  assert.match(composer, /height:photo\.height/);
});

test('photo upload maintains private original and preview contracts, skips redundant tiny preview', () => {
  assert.match(uploader, /prepareCommunityJpegUri\(uri, webFile, \{mimeType,width,height\}\)/);
  assert.match(uploader, /prepared\.sizeBytes > 320 \* 1024/);
  assert.match(uploader, /communityWallPreviewOriginalPath\(path\)/);
  assert.match(uploader, /communityWallPreviewPath\(taggedOriginal\)/);
  assert.match(uploader, /actualPath = taggedOriginal/);
  assert.match(uploader, /await uploadCommunityBinaryFile\(\{\s*path: actualPath,/);
  assert.match(uploader, /\.createSignedUploadUrl\(path, \{ upsert: false \}\)/);
  assert.match(composer, /enqueueCommunityPublish\(/);
  assert.match(composer, /snapshot\.photos/);
});

test('clip timeline grabs drag, moves the selected window and exposes accessible nudge controls', () => {
  assert.match(timeline, /onMoveShouldSetPanResponderCapture:\(\)=>true/);
  assert.match(timeline, /onShouldBlockNativeResponder:\(\)=>true/);
  assert.match(timeline, /onPanResponderMove:/);
  assert.match(timeline, /apply\(s\+seconds,d\)/);
  assert.match(timeline, /nudge\(-5\)/);
  assert.match(timeline, /nudge\(5\)/);
  assert.match(timeline, /emitPreview\(next,true\)/);
  assert.match(music, /nestedScrollEnabled style=\{\{flex:1,minHeight:84\}\}/);
  assert.match(music, /maxHeight:44/);
  assert.match(music, /onScrub=\{start=>/);
});

test('ambiance controls stay horizontal and overlays remain lightweight and non-interactive', () => {
  assert.match(composer, /<ScrollView horizontal showsHorizontalScrollIndicator=\{false\}/);
  assert.match(composer, /group\.items\.map\(preset/);
  assert.match(ambiance, /const count=preset==='storm'\?24/);
  assert.match(ambiance, /pointerEvents="none"/);
  assert.match(ambiance, /AccessibilityInfo\.isReduceMotionEnabled/);
  assert.match(ambiance, /AppState\.addEventListener/);
  assert.match(ambiance, /useNativeDriver:Platform\.OS!=='web'/);
  assert.doesNotMatch(ambiance, /expo-video|createVideoPlayer|expo-audio/);
});
