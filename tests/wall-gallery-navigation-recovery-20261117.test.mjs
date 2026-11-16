import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const picker = readFileSync('src/lib/buklodPickCommunityPhotos.ts', 'utf8');
const wall = readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');
const config = readFileSync('app.config.js', 'utf8');

test('both Wall pickers retain the direct web user-gesture path', () => {
  assert.equal((picker.match(/const result = await ImagePicker\.launchImageLibraryAsync\(pickerOptions\)/g) ?? []).length, 2);
  assert.equal((picker.match(/\.catch\(error => recoverAndroidCommunityLibrary/g) ?? []).length, 2);
  assert.ok(picker.includes("if (Platform.OS !== 'android') throw originalError"));
  assert.ok(!picker.includes("await import('expo-image-picker')"));
});

test('failed Android picker uses scoped recovery without changing app permissions', () => {
  assert.ok(picker.includes("import * as DocumentPicker from 'expo-document-picker'"));
  assert.ok(picker.includes('legacy: true'));
  assert.ok(picker.includes('DocumentPicker.getDocumentAsync({'));
  assert.ok(picker.includes("type: 'image/*'"));
  assert.ok(picker.includes('copyToCacheDirectory: true'));
  assert.ok(picker.includes('slice(0, remainingPhotos)'));
  assert.ok(picker.includes('if (remainingPhotos <= 0) throw legacyError'));
  assert.ok(config.includes("'android.permission.READ_MEDIA_IMAGES'"));
  assert.ok(config.includes("'android.permission.READ_MEDIA_VIDEO'"));
});

test('Files fallback accepts only image MIME and never unverified-duration videos', () => {
  assert.ok(picker.includes('^image\\/('));
  assert.ok(picker.includes("type: 'image' as const"));
  assert.ok(picker.includes('if (remainingPhotos <= 0) throw legacyError'));
  assert.ok(picker.includes('return { canceled: true, assets: null }'));
});

test('video preparation failure has its own safe UI error', () => {
  assert.ok(wall.includes("'gallery_video_prepare_failed'"));
  assert.ok(wall.includes("'Video not prepared'"));
  assert.ok(wall.includes("'gallery_pick_failed'"));
});
