import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const wall = readFileSync('src/app/(tabs)/buklod.tsx','utf8');

test('main Wall privacy revocation changes only feed state, not routing', () => {
  assert.match(wall,/const privacyRevokedPostIdsRef=useRef\(new Set<string>\(\)\)/);
  assert.match(wall,/communityLoadSeqRef\.current\+=1; \/\/ Cancel stale in-flight feed responses/);
  assert.match(wall,/setPosts\(current=>current\.filter/);
  assert.match(wall,/setVideoViewerPosts\(current=>current\.filter/);
});

test('privacy revocation does not replace normal debounced Wall reload', () => {
  assert.match(wall,/const requestReload = \(\) => \{/);
  assert.match(wall,/\}, 900\);/);
  assert.match(wall,/requestReload\(\);\s*\}\s*\)\s*\.subscribe\(\)/);
});
