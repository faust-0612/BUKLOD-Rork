import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const wall = readFileSync('src/app/(tabs)/buklod.tsx', 'utf8');
const upload = readFileSync('src/lib/uploadCommunityVideoFile.ts', 'utf8');
const creatives = readFileSync('src/lib/buklodPostCreatives.ts', 'utf8');
const media = readFileSync('src/lib/buklodCommunityWallMedia.ts', 'utf8');
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
  assert.match(upload, /isJpeg && existingBytes > 0 && existingBytes <= 12 \* 1024 \* 1024/);
  assert.match(upload, /if \(isJpeg && existingBytes > 0 && existingBytes <= 45 \* 1024 \* 1024\)/);
  assert.match(upload, /throw error;/);
});

test('non-JPEG images cannot be uploaded while falsely labelled JPEG', () => {
  assert.match(upload, /if \(isJpeg && existingBytes > 0 && existingBytes <= 12 \* 1024 \* 1024\)/);
  assert.match(upload, /This photo could not be converted in your browser/);
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

test('Safari WebView Load failed is a network upload error, not unexplained SYS-500', () => {
  assert.match(media, /network request failed\|failed to fetch\|network error\|load failed/);
  assert.match(media, /case 'network':/);
});

test('web photo and gallery pickers open on the active user gesture', () => {
  const picker = readFileSync('src/lib/buklodPickCommunityPhotos.ts', 'utf8');
  assert.match(picker, /import \* as ImagePicker from 'expo-image-picker'/);
  assert.doesNotMatch(picker, /await import\('expo-image-picker'\)/);
  const pickers = [picker.indexOf('export async function pickCommunityPhotos('),
    picker.indexOf('export async function pickCommunityGallery(')];
  for (const start of pickers) {
    const section = picker.slice(start, picker.indexOf('const result = await ImagePicker.launchImageLibraryAsync', start));
    assert.ok(start > 0);
    assert.match(section, /if \(Platform\.OS !== 'web'\)/);
    assert.match(section, /ImagePicker\.requestMediaLibraryPermissionsAsync/);
    assert.doesNotMatch(section, /await import\(/);
  }
});

test('browser-selected image File stays alive from picker through Storage PUT', () => {
  const picker = readFileSync('src/lib/buklodPickCommunityPhotos.ts', 'utf8');
  assert.match(picker, /webFile: Platform\.OS === 'web' \? asset\.file/);
  assert.match(wall, /webFile\?:Blob/);
  assert.match(wall, /\.\.\.picked\.photos,/);
  assert.match(wall, /webFile:photo\.webFile/);
  assert.match(upload, /prepareCommunityJpegUri\(uri, webFile\)/);
  assert.match(upload, /webBlob: prepared\.webBlob/);
  assert.match(upload, /webBlob,\s*contentType/);
  assert.match(upload, /const blob = webBlob \?\? await readWebBlob\(uri\)/);
});

test('JPEG uploads do not require conversion; non-JPEG must become an actual JPEG', () => {
  assert.match(upload, /isJpeg && existingBytes > 0 && existingBytes <= 12 \* 1024 \* 1024/);
  assert.match(upload, /const actualMime = String\(webSelectedBlob\?\.type/);
  assert.match(upload, /\^image\\\/jpe\?g\$/);
  assert.match(upload, /webBlob = Platform\.OS === 'web'/);
  assert.match(upload, /Prepared photo is not a valid JPEG/);
  assert.match(upload, /canvas\.toBlob\(resolve, 'image\/jpeg', 0\.82\)/);
  assert.match(upload, /URL\.revokeObjectURL\(url\)/);
  assert.match(upload, /if \(converted\) \{/);
});

test('video and native storage paths remain unchanged and web photo concurrency is bounded', () => {
  assert.match(wall, /Platform\.OS==='web'\?2:3/);
  assert.match(upload, /export async function uploadCommunityVideoFile/);
  assert.match(upload, /FileSystem\.createUploadTask\(/);
  assert.match(upload, /FileSystem\.uploadAsync\(/);
  assert.match(upload, /await uploadCommunitySignedPut\(/);
  assert.match(upload, /method: 'PUT'/);
});

test('only photo failures get photo recovery instructions', () => {
  assert.match(wall, /publishStage === 'upload_photo'/);
  assert.match(wall, /Photo upload failed\. Your draft was restored/);
  assert.match(wall, /setPhotos\(current => current\.length \? current : snapshot\.photos\)/);
});
