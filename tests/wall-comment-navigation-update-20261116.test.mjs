import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const wall = readFileSync(new URL('../src/app/(tabs)/buklod.tsx', import.meta.url), 'utf8');
const preview = readFileSync(new URL('../src/components/BuklodCommunityPostEngagement.tsx', import.meta.url), 'utf8');

test('latest comment remains a pressable route to its exact discussion', () => {
  assert.match(preview, /onOpenComments/);
  assert.match(preview, /onPress=\{onOpenComments\}/);
  assert.match(wall, /onOpenComments=\{\(\) =>\s*openComments\(item\)/);
  assert.match(wall, /communityLoadSeq !== communityLoadSeqRef\.current/);
});
