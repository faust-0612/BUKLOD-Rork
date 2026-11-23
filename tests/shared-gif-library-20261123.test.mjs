import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const source = read('src/lib/buklodConnectGifCatalog.ts');

function catalog({ env = {}, fetchFn = () => { throw new Error('Offline'); } } = {}) {
  // This focused CI job intentionally does not npm install. Use Node's
  // built-in TypeScript stripper instead of a package/dev-dependency.
  const module = { exports: {} };
  const stubbed = source
    .replace("import * as FileSystem from 'expo-file-system/legacy';",
      "const FileSystem = { cacheDirectory: 'file:///cache/' };")
    .replace("import { File } from 'expo-file-system';",
      "class File { size = 1024; }")
    .replace("import { Platform } from 'react-native';",
      "const Platform = { OS: 'android' };")
    .replace(/import \{\s*type ConnectPickedFile,\s*\} from '@\/lib\/buklodConnect';/, '');
  const js = stripTypeScriptTypes(stubbed, { mode: 'strip' })
    .replace(/^export\s+(?=const|function|async function)/gm, '') +
    '\\nmodule.exports = { CONNECT_GIF_CATEGORIES, searchConnectGifs, getConnectGifCatalogItem };';
  vm.runInNewContext(js, {
    module, exports: module.exports,
    process: { env }, fetch: fetchFn,
    setTimeout, clearTimeout, AbortController, URLSearchParams,
  }, { filename: 'buklodConnectGifCatalog.js' });
  return module.exports;
}

test('without provider credentials, Christian reactions and other categories stay usable', async () => {
  const c = catalog();
  assert.ok(c.CONNECT_GIF_CATEGORIES.includes('Amen'));
  assert.ok(c.CONNECT_GIF_CATEGORIES.includes('Worship'));
  for (const cat of ['Amen', 'Worship', 'Prayer', 'Happy', 'Greetings']) {
    const result = await c.searchConnectGifs({ category: cat });
    assert.equal(result.provider, 'fallback');
    assert.ok(result.items.length > 0, cat);
    assert.ok(result.items.every(item => item.url.startsWith('https://')));
  }
});

test('configured online provider adds paging without changing existing send schema', async () => {
  let endpoint = '';
  const c = catalog({
    env: { EXPO_PUBLIC_GIPHY_ANDROID_API_KEY: 'test-platform-key' },
    fetchFn: async (url, options) => {
      endpoint = String(url);
      assert.ok(options.signal, 'bounded provider request');
      return { ok: true, json: async () => ({
        data: [{ id: 'verified-1', title: 'Amen GIF', images: {
          fixed_width_small: { url: 'https://media.giphy.com/a-preview.gif' },
          original: { url: 'https://media.giphy.com/a.gif' },
        } }],
        pagination: { count: 1, total_count: 40 },
      }) };
    },
  });
  const result = await c.searchConnectGifs({ category: 'Amen', offset: 0, limit: 1 });
  assert.equal(result.provider, 'giphy');
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 'giphy-verified-1');
  assert.equal(result.items[0].url, 'https://media.giphy.com/a.gif');
  assert.equal(result.hasMore, true);
  assert.equal(result.nextOffset, 1);
  assert.ok(endpoint.includes('rating=g'));
  assert.ok(endpoint.includes('api_key=test-platform-key'));
  assert.equal(c.getConnectGifCatalogItem('giphy-verified-1')?.provider, 'giphy');
});

test('provider error gracefully uses the nonempty cached starter catalog', async () => {
  const c = catalog({
    env: { EXPO_PUBLIC_GIPHY_API_KEY: 'test-key' },
    fetchFn: async () => ({ ok: false, status: 503 }),
  });
  const result = await c.searchConnectGifs({ category: 'Prayer' });
  assert.equal(result.provider, 'fallback');
  assert.ok(result.warning);
  assert.ok(result.items.length > 0);
});

test('Public/Scoped Wall and comment sheets share the picker without auto-publishing', () => {
  const picker = read('src/components/BuklodCommunityGifPicker.tsx');
  const comment = read('src/components/BuklodCommunityCommentComposer.tsx');
  const wall = read('src/app/(tabs)/buklod.tsx');
  const scope = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const connect = read('src/components/connect/ConnectComposerPicker.tsx');
  assert.match(picker, /searchConnectGifs/);
  assert.match(picker, /onPickRemote/);
  assert.match(picker, /downloadConnectCatalogGif/);
  assert.match(picker, /onPick\(file\)/);
  assert.doesNotMatch(picker, /COMMUNITY GIF RETIRED/);
  assert.match(comment, /<BuklodCommunityGifPicker/);
  assert.match(comment, /onPickRemote=\{pickGif\}/);
  assert.match(comment, /onPress=\{onSend\}/);
  assert.match(wall, /Browse GIF library for Community post/);
  assert.match(scope, /Browse GIF library for this community/);
  assert.match(connect, /searchConnectGifs/);
  assert.match(wall, /uploadCommunityGifFile/);
  assert.match(scope, /uploadCommunityGifFile/);
});
