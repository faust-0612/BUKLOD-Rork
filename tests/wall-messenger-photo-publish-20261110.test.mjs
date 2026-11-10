import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const wall = readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');
const upload = readFileSync('src/lib/uploadCommunityVideoFile.ts', 'utf8');
const creatives = readFileSync('src/lib/buklodPostCreatives.ts', 'utf8');
const publish = wall.slice(wall.indexOf(' const publish=async()=>{'), wall.indexOf('/* BUKLOD_COMMUNITY_AUTHOR_FOLLOW_ALL_R2 */'));

test('music and motion are never required to publish a normal post', () => {
  assert.match(creatives, /motion === 'none' && !input\.musicTrackId\) return/);
  assert.match(wall, /useState<BuklodPostMotionPreset>\('none'\)/);
  assert.match(publish, /!body\.trim\(\) &&\s*!photos\.length &&\s*!wallVideo186O/);
  assert.match(publish, /catch\(creativeError:any\)\{/);
});

test('feed refresh cannot reverse a committed publish', () => {
  const createPost = publish.slice(publish.indexOf('  const createPost=async('), publish.indexOf('\n  try{', publish.indexOf('  const createPost=async(')));
  assert.doesNotMatch(createPost, /\bload\(\)/);
  assert.match(publish, /\/\/ A feed refresh error must not roll back a successfully published post\.[\s\S]{0,90}void load\(\)\.catch\(\(\)=>undefined\)/);
});

test('iPhone web JPEG MIME is recognized even without a filename', () => {
  assert.match(upload, /const webSelectedBlob = Platform\.OS === 'web'/);
  assert.match(upload, /webSelectedBlob\?\.type/);
  assert.match(upload, /isJpeg && existingBytes > 0 && existingBytes <= 2 \* 1024 \* 1024/);
  assert.match(upload, /if \(Platform\.OS === 'web'\) \{[\s\S]{0,160}isJpeg && existingBytes > 0 && existingBytes <= 12 \* 1024 \* 1024/);
  assert.match(upload, /throw error;/);
});

test('non-JPEG images cannot be uploaded while falsely labelled JPEG', () => {
  assert.match(upload, /if \(isJpeg && existingBytes > 0 && existingBytes <= 12 \* 1024 \* 1024\)/);
  assert.match(upload, /Photo conversion failed in this browser/);
  assert.match(upload, /contentType: 'image\/jpeg'/);
});

test('publish failure preserves draft and records privacy-safe stage', () => {
  assert.match(publish, /setPhotos\(current => current\.length \? current : snapshot\.photos\)/);
  assert.match(publish, /publishStage = 'upload_photo'/);
  assert.match(publish, /publishStage = 'create_post'/);
  assert.match(publish, /publishStage = 'attach_media'/);
  assert.match(publish, /outcome:'post_publish_'\+publishStage/);
  assert.match(publish, /metadata:\{stage:publishStage, photoCount:snapshot\.photos\.length, platform:Platform\.OS\}/);
  assert.doesNotMatch(publish, /metadata:\{[^}]*snapshot\.body/);
});
