import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const marites = readFileSync('src/lib/buklodMaritesBoard.ts', 'utf8');
const composer = readFileSync('src/components/BuklodMaritesBoard.tsx', 'utf8');
const wall = readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');
const shared = readFileSync('src/lib/uploadCommunityVideoFile.ts', 'utf8');
const tus = readFileSync('src/lib/uploadCommunityResumableTus.ts', 'utf8');

test('Marites photos take the existing direct-file Wall fast path, without Base64 or sequential Storage PUTs', () => {
  assert.match(marites, /await mapWithConcurrency\(/);
  assert.match(marites, /uploadCommunityPhotoFile\(\{ path, uri \}\)/);
  assert.match(marites, /Platform\.OS === 'web' \? 2 : 3/);
  assert.doesNotMatch(marites, /encodeMaritesPhotoBase64/);
  assert.doesNotMatch(marites, /\.upload\(path, encoded\.decode/);
  assert.match(shared, /quality === 'normal' \? Math\.max\(1, concurrency\) : 1/);
});

test('Marites multi-photo uploads finish their active work before rollback and preserve photo ordering', () => {
  const uploadStart = marites.indexOf('const photoResults = await mapWithConcurrency(');
  const uploadEnd = marites.indexOf('const first = uploaded[0]', uploadStart);
  assert.ok(uploadStart >= 0 && uploadEnd > uploadStart);
  const batch = marites.slice(uploadStart, uploadEnd);
  assert.match(batch, /catch \(error\)/);
  assert.match(batch, /for \(const result of photoResults\)/);
  assert.match(batch, /if \(result\.media\) uploaded\.push\(result\.media\)/);
  assert.ok(batch.indexOf('if (failed?.error) throw failed.error') > batch.indexOf('for (const result of photoResults)'));
  assert.match(marites, /discardIncompleteCommunityPost\(\{[\s\S]*?mediaPaths: uploaded\.map\(/);
});

test('Marites reports real video and photo upload progress, while both feeds retain private video upload protections', () => {
  assert.match(marites, /onProgress\?: \(status: string\) => void/);
  assert.match(marites, /onProgress: \(\{ ratio \}\) =>/);
  assert.match(marites, /Uploading photos \$\{completed\}\/\$\{photoUris\.length\}/);
  assert.match(marites, /Finishing story/);
  assert.match(composer, /onProgress: setPostingStatus/);
  assert.match(composer, /posting \? \(postingStatus \|\| 'Posting…'\)/);
  assert.match(wall, /enqueueCommunityPublish\(/);
  assert.match(wall, /await uploadCommunityVideoFile\(/);
  assert.match(wall, /await uploadCommunityPhotoFile\(/);
  assert.match(shared, /preferResumable: true/);
  assert.match(tus, /method: 'HEAD'/);
  assert.match(tus, /method: 'PATCH'/);
});
