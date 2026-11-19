import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('local Android GIF IME Expo library has explicit Android version metadata for Gradle configuration', () => {
  const gradle = readFileSync(new URL('../modules/buklod-genesis-ime/android/build.gradle', import.meta.url), 'utf8');
  assert.match(gradle, /id 'com\.android\.library'/);
  assert.match(gradle, /id 'expo-module-gradle-plugin'/);
  assert.match(gradle, /defaultConfig\s*\{[^}]*minSdkVersion 24[^}]*versionCode 1[^}]*versionName '1\.0\.0'[^}]*\}/s);
  assert.match(gradle, /namespace 'expo\.modules\.buklodgenesisime'/);
});
