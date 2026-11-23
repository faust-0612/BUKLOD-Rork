import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/* Dependency-free behavioral harness for the CI source gate:
   strip TS with the Node 22 built-in instead of requiring npm-installed typescript. */
function loadTs(file, mocks, exportsToRead) {
  const source = readFileSync(file, 'utf8')
    .replace(/^\s*import\s+[\s\S]*?\sfrom\s+['"][^'"]+['"];?/gm, '')
    .replace(/await import\('@\/lib\/uploadCommunityVideoFile'\)/g, 'globalThis.__uploadMocks');
  const stripped = stripTypeScriptTypes(source, { mode: 'transform' })
    .replace(/^\s*export\s+(?=(?:async\s+)?(?:function|const|class)\b)/gm, '')
    .replace(/^\s*export\s*\{\s*\}\s*;?\s*$/gm, '');
  const context = {
    ...mocks, __uploadMocks: mocks.__uploadMocks ?? {},
    console, setTimeout, clearTimeout, Date, Math,
  };
  vm.runInNewContext(
    stripped + '\n;globalThis.__result = {' + exportsToRead.join(',') + '};',
    context, { filename: file },
  );
  return context.__result;
}

function modelFixture({ failPhoto = null } = {}) {
  const completed = [];
  const attached = [];
  const discarded = [];
  const progress = [];
  let postCreates = 0;
  const mocks = {
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
    'react-native': { Platform: { OS: 'android' } },
    '@/lib/repairMojibakeText': { repairMojibakeText: value => value },
    '@/lib/buklodCommunityPostMedia': {
      attachCommunityPostMedia: async (id, media) => attached.push({ id, paths: media.map(m => m.media_path) }),
      discardIncompleteCommunityPost: async data => discarded.push(data),
    },
    __uploadMocks: {
      mapWithConcurrency: (items, limit, mapper) => {
        assert.equal(limit, 3);
        return Promise.all(items.map((item, index) => mapper(item, index)));
      },
      uploadCommunityPhotoFile: async ({ path, uri, profile }) => {
        assert.equal(profile, 'story');
        // Second image finishes first to expose ordering bugs.
        await sleep(uri === 'photo-1' ? 18 : 1);
        if (uri === failPhoto) throw new Error('Photo network error');
        completed.push(path);
        return { path, sizeBytes: 12345 };
      },
    },
    '@/lib/supabase': {
      supabase: {
        rpc: async () => { postCreates += 1; return { data: 'post-new', error: null }; },
        storage: { from: () => ({
          createSignedUrl: async path => ({
            data: { signedUrl: 'https://example.test/private/signed/' + encodeURIComponent(path) },
            error: null,
          }),
        }) },
      },
    },
  };
  const model = loadTs('src/lib/buklodMaritesBoard.ts', {
    ...mocks,
    Platform: { OS: 'android' },
    FileSystem: { documentDirectory: null },
    AsyncStorage: mocks['@react-native-async-storage/async-storage'],
    repairMojibakeText: mocks['@/lib/repairMojibakeText'].repairMojibakeText,
    supabase: mocks['@/lib/supabase'].supabase,
    attachCommunityPostMedia: mocks['@/lib/buklodCommunityPostMedia'].attachCommunityPostMedia,
    discardIncompleteCommunityPost: mocks['@/lib/buklodCommunityPostMedia'].discardIncompleteCommunityPost,
  }, ['publishMaritesStory']);
  return { model, completed, attached, discarded, progress, getPostCreates: () => postCreates };
}

test('Marites uploads photos concurrently, publishes only after settlement, and retains selected photo order', async () => {
  const f = modelFixture();
  const result = await f.model.publishMaritesStory({
    userId: 'member-1', authorName: 'Member', body: 'A story',
    photoUris: ['photo-1', 'photo-2'],
    onProgress: status => f.progress.push(status),
  });
  assert.equal(result.shared, true);
  assert.equal(f.getPostCreates(), 1);
  assert.equal(f.attached.length, 1);
  assert.equal(f.attached[0].paths.length, 2);
  assert.match(f.attached[0].paths[0], /marites-.*-0-/);
  assert.match(f.attached[0].paths[1], /marites-.*-1-/);
  assert.match(f.completed[0], /marites-.*-1-/); // reverse completion
  assert.deepEqual(f.progress.filter(x => x.startsWith('Uploading photos')), [
    'Uploading photos 0/2', 'Uploading photos 1/2', 'Uploading photos 2/2',
  ]);
  assert.equal(f.progress.at(-1), 'Finishing story…');
  assert.equal(f.discarded.length, 0);
});

test('Marites waits for all photo attempts before cleaning partial uploads and never creates an incomplete post', async () => {
  const f = modelFixture({ failPhoto: 'photo-2' });
  const result = await f.model.publishMaritesStory({
    userId: 'member-1', authorName: 'Member', body: 'Draft',
    photoUris: ['photo-1', 'photo-2'],
    onProgress: status => f.progress.push(status),
  });
  // Existing product policy is device-local fallback, not a discarded draft.
  assert.equal(result.shared, false);
  assert.equal(result.story.source, 'local');
  assert.equal(f.completed.length, 1);
  assert.equal(f.getPostCreates(), 0);
  assert.equal(f.attached.length, 0);
  assert.equal(f.discarded.length, 1);
  assert.equal(f.discarded[0].postId, null);
  assert.equal(f.discarded[0].mediaPaths.length, 1);
  assert.equal(f.discarded[0].mediaPaths[0], f.completed[0]);
});

test('Shared uploader preserves concurrency policy on weak network and result ordering on normal network', async () => {
  let quality = 'normal';
  const module = loadTs('src/lib/uploadCommunityVideoFile.ts', {
    classifyNetworkQuality: () => quality,
    Platform: { OS: 'android' },
  }, ['mapWithConcurrency']);
  const batch = async () => {
    let active = 0, peak = 0;
    const values = await module.mapWithConcurrency([0, 1, 2, 3], 3, async n => {
      active++;
      peak = Math.max(peak, active);
      await sleep(n === 0 ? 10 : 2);
      active--;
      return 'photo-' + n;
    });
    return { peak, values: Array.from(values) };
  };
  assert.deepEqual(await batch(), {
    peak: 3, values: ['photo-0', 'photo-1', 'photo-2', 'photo-3'],
  });
  quality = 'degraded';
  assert.deepEqual(await batch(), {
    peak: 1, values: ['photo-0', 'photo-1', 'photo-2', 'photo-3'],
  });
});
