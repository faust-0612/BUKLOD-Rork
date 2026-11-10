import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');
const start = source.indexOf(' const publish=async()=>{');
const end = source.indexOf('/* BUKLOD_COMMUNITY_AUTHOR_FOLLOW_ALL_R2 */', start);
const publish = source.slice(start, end);

test('photo upload repair preserves canonical Wall route and composer navigation', () => {
  assert.ok(start > 0 && end > start);
  assert.match(source, /<Redirect\s+href=\{'\/scope\?section=community'/);
  assert.match(publish, /setCommunityComposerOpen\(false\); \/\/ Return to compact posting bar immediately\./);
  assert.match(publish, /setCommunityComposerOpen\(true\)/);
  assert.doesNotMatch(publish, /router\.(?:push|replace|back)\(/);
});

test('photo publish remains single-flight while preserving recoverable drafts', () => {
  assert.match(publish, /if\(!user \|\| postingSubmissionRef\.current\)return/);
  assert.match(publish, /postingSubmissionRef\.current=true/);
  assert.match(publish, /postingSubmissionRef\.current=false/);
  assert.match(publish, /setPhotos\(current => current\.length \? current : snapshot\.photos\)/);
  assert.match(publish, /setWallVideo186O\(current => current \?\? snapshot\.wallVideo\)/);
});
