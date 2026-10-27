const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const root = require('node:path').resolve(__dirname, '..');
function compile(file, mocks = {}) {
  const source = fs.readFileSync(`${root}/${file}`, 'utf8');
  const result = ts.transpileModule(source, {fileName: file, reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}});
  assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file);
  const exports = {};
  vm.runInNewContext(result.outputText, {exports, require: name => mocks[name] || {}, console, Date, setTimeout, clearTimeout});
  return exports;
}
const {selectVisibleMaritesVideo: select, quickVideoDurationSeconds: duration} = compile('src/lib/buklodMaritesPlayback.ts');
const bounds = {x: 0, y: 100, width: 360, height: 252, windowWidth: 360, windowHeight: 800, topInset: 24, bottomInset: 64, offset: 0, cardWidth: 186, gap: 7, videos: [true, true, true]};
assert.equal(select(bounds), 0);
assert.equal(select({...bounds, y: -252}), -1);
assert.equal(select({...bounds, y: 800}), -1);
assert.equal(select({...bounds, offset: 193}), 1);
assert.equal(select({...bounds, offset: 9999}), -1);
assert.equal(select({...bounds, videos: [false, true, true]}), 1);
assert.equal(select({...bounds, y: 700}), -1);
assert.equal(select({...bounds, width: 0}), -1);
assert.equal(select({...bounds, x: NaN}), -1);
assert.equal(duration(500), 0.5);
assert.equal(duration(1000), 1);
assert.equal(duration(30000), 30);
assert.ok(duration(30001) > 30);
let cached = null;
const storage = {getItem: async () => cached, setItem: async (_, value) => {cached = value;}};
const model = compile('src/lib/buklodMaritesBoard.ts', {
  '@react-native-async-storage/async-storage': storage,
});
const now = Date.now();
const story = {id: 'local:test', user_id: 'owner', body: '', created_at: new Date(now - 1000).toISOString(), video_uri: 'file:///video.mp4'};
assert.equal(model.isActiveMaritesStory(story, now), true);
for (const age of [72*3600000, 72*3600000+1]) assert.equal(model.isActiveMaritesStory({...story, created_at: new Date(now-age).toISOString()}, now), false);
assert.equal(model.isActiveMaritesStory({...story, created_at: 'invalid'}, now), false);
assert.equal(model.isActiveMaritesStory({...story, created_at: new Date(now+1000).toISOString()}, now), false);
assert.equal(model.filterMaritesStoriesForViewer([{...story, author_only: true}], 'other').length, 0);
assert.equal(model.filterMaritesStoriesForViewer([{...story, author_only: true}], 'owner').length, 1);
assert.equal(model.filterMaritesStoriesForViewer([{...story, author_only: false}], 'other').length, 0);
assert.equal(model.filterMaritesStoriesForViewer([{...story, source: 'community', author_only: false}], 'other').length, 1);
assert.equal(model.mergeMaritesStories([story], [story]).length, 1);
(async () => {
  await model.saveMaritesStories([story]);
  const restored = await model.loadMaritesStories();
  assert.equal(restored[0].video_uri, story.video_uri);
  // AWS videos must retain their provider-issued S3 URL. Attempting to
  // sign the aws: path through Supabase would produce a black video card.
  const post = {id: 'post-1', user_id: 'author', body: model.MARITES_POST_MARKER,
    media_path: 'aws:video-key', media_mime_type: 'video/mp4', created_at: story.created_at};
  const awsUrl = 'https://s3.example.test/video?X-Amz-Signature=test';
  const awsModel = compile('src/lib/buklodMaritesBoard.ts', {
    '@react-native-async-storage/async-storage': storage,
    '@/lib/repairMojibakeText': {repairMojibakeText: value => value},
    '@/lib/buklodPersonDisplay': {hydratePersonNamesOnRows: async rows => rows},
    '@/lib/buklodMaritesFeedPages': {
      maritesFeedPageLimit: value => value,
      collectMaritesFeedPages: async () => ({rows: [post], complete: true, error: null}),
    },
    '@/lib/buklodCommunityPostMedia': {loadCommunityPostMediaByPostIds: async () => ({
      [post.id]: [{post_id: post.id, media_path: post.media_path,
        media_mime_type: 'video/mp4', storage_provider: 'AWS', media_url: awsUrl}],
    })},
    '@/lib/supabase': {supabase: {storage: {from: () => ({
      createSignedUrl: async path => {throw new Error(`Wrong provider: ${path}`);},
    })}}},
  });
  const awsFeed = await awsModel.loadCommunityMaritesStories(null, null);
  assert.equal(awsFeed.refreshFailed, false);
  assert.equal(awsFeed.stories.length, 1);
  assert.equal(awsFeed.stories[0].video_uri, awsUrl);

  // An unavailable community RPC must persist a video in app-owned storage,
  // never an ImagePicker temp URI that can disappear after restart.
  const fileOps = [];
  const offlineModel = compile('src/lib/buklodMaritesBoard.ts', {
    '@react-native-async-storage/async-storage': storage,
    'react-native': {Platform: {OS: 'android'}},
    'expo-file-system/legacy': {
      documentDirectory: 'file:///app/documents/',
      makeDirectoryAsync: async dir => fileOps.push(['mkdir', dir]),
      copyAsync: async args => fileOps.push(['copy', args]),
      getInfoAsync: async () => ({exists: true, size: 1234}),
    },
    '@/lib/repairMojibakeText': {repairMojibakeText: value => value},
    '@/lib/uploadCommunityVideoFile': {uploadCommunityVideoFile: async () => {}},
    '@/lib/buklodCommunityPostMedia': {discardIncompleteCommunityPost: async () => {}},
    '@/lib/supabase': {supabase: {rpc: async () => ({data: null,
      error: {message: 'Could not find the function create_buklod_community_post_v3'}})}},
  });
  const offline = await offlineModel.publishMaritesStory({userId: 'owner', authorName: 'Owner',
    body: '', photoUris: [], video: {uri: 'file:///picker/temporary.mp4', durationSeconds: 10, mimeType: 'video/mp4'}});
  assert.equal(offline.shared, false);
  assert.ok(offline.story.video_uri.startsWith('file:///app/documents/buklod-marites-offline/'));
  assert.equal(fileOps.filter(([operation]) => operation === 'copy').length, 1);

  // The live Community RPC disallows video MIME on the initial post.
  // Marites must create its marked text post first, then attach media through
  // the owner-checked media RPC without weakening regular Wall rules.
  let createArgs = null;
  let attachedMedia = null;
  const publishedUrl = 'https://storage.example.test/video?token=valid';
  const publishedModel = compile('src/lib/buklodMaritesBoard.ts', {
    '@react-native-async-storage/async-storage': storage,
    'react-native': {Platform: {OS: 'android'}},
    '@/lib/repairMojibakeText': {repairMojibakeText: value => value},
    '@/lib/uploadCommunityVideoFile': {uploadCommunityVideoFile: async () => {}},
    '@/lib/buklodCommunityPostMedia': {
      attachCommunityPostMedia: async (id, media) => {attachedMedia = {id, media};},
      loadCommunityPostMediaByPostIds: async () => ({
        'published-1': [{media_mime_type: 'video/mp4', media_url: publishedUrl}],
      }),
    },
    '@/lib/supabase': {supabase: {rpc: async (_, args) => {
      createArgs = args;
      return {data: 'published-1', error: null};
    }}},
  });
  const published = await publishedModel.publishMaritesStory({userId: 'owner', authorName: 'Owner',
    body: '', photoUris: [], video: {uri: 'file:///picker/temporary.mp4', durationSeconds: 10, mimeType: 'video/mp4'}});
  assert.equal(published.shared, true);
  assert.equal(createArgs.p_media_path, null);
  assert.equal(createArgs.p_media_mime_type, null);
  assert.equal(createArgs.p_media_size_bytes, null);
  assert.equal(attachedMedia.id, 'published-1');
  assert.equal(attachedMedia.media.length, 1);
  assert.equal(attachedMedia.media[0].media_mime_type, 'video/mp4');
  assert.equal(published.story.video_uri, publishedUrl);

  console.log('PASS: Marites text-first video publishing, AWS URL preservation, offline copy, isolation and release contracts');
})().catch(error => {console.error(error); process.exitCode = 1;});
