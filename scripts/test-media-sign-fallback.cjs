const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const source = fs.readFileSync(__dirname + '/../src/lib/buklodMediaUrl.ts', 'utf8')
  .replace(/^import .*;\n/gm, '').replace(/export /g, '')
  .replace('const SIGN_TIMEOUT_MS = 6000;', 'const SIGN_TIMEOUT_MS = 60;');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function harness(batch, individual) {
  const stats = { active: 0, peak: 0, calls: [], batches: 0 };
  const context = vm.createContext({ setTimeout, clearTimeout, Date, Map, Promise,
    AsyncStorage: { getItem: async () => null, setItem: async () => {} },
    runCommunityMediaPrefetch: async () => {},
    withBuklodTimeout: async (task, ms) => {
      let timer;
      try { return await Promise.race([task, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      })]); } finally { clearTimeout(timer); }
    },
    supabase: { storage: { from: () => ({
      createSignedUrls: async paths => { stats.batches++; return batch(paths); },
      createSignedUrl: async path => {
        stats.calls.push(path); stats.active++; stats.peak = Math.max(stats.peak, stats.active);
        try { return await individual(path); } finally { stats.active--; }
      },
    }) } },
  });
  vm.runInContext(stripTypeScriptTypes(source), context);
  return { context, stats, resolve: path => context.resolveCommunityMediaUrl(path) };
}
const signed = path => ({ data: { signedUrl: 'https://host/' + path } });
(async () => {
  let h = harness(paths => ({ data: [{ path: paths[0], signedUrl: 'https://host/batch' }] }), signed);
  const partial = await Promise.all(['batch', 'missing'].map(h.resolve));
  assert.deepEqual(partial, ['https://host/batch', 'https://host/missing']);
  assert.deepEqual(h.stats.calls, ['missing'], 'only missing items retry');
  h = harness(() => ({ error: new Error('batch failed') }), async path => { await delay(10); return signed(path); });
  const all = await Promise.all(Array.from({ length: 8 }, (_, i) => h.resolve('item' + i)));
  assert(all.every(Boolean)); assert.equal(h.stats.peak, 3);
  h = harness(() => ({ data: [] }), async path => { await delay(45); return signed(path); });
  const first = Promise.all(['a', 'b', 'c'].map(h.resolve));
  await delay(30);
  const second = Promise.all(['d', 'e', 'f'].map(h.resolve));
  await Promise.all([first, second]);
  assert.equal(h.stats.peak, 3, 'global limit across overlapping batches');
  let release;
  const stuck = new Promise(resolve => { release = resolve; });
  h = harness(() => ({ data: [] }), async path => { await stuck; return signed(path); });
  const expired = await Promise.all(['slow1', 'slow2', 'slow3'].map(h.resolve));
  assert(expired.every(url => url === null)); assert.equal(h.stats.active, 3);
  assert.equal(await h.resolve('overflow'), null);
  assert.equal(h.stats.calls.length, 3, 'timed-out requests retain slots until settled');
  assert.equal(h.context.peekCommunityMediaUrl('slow1'), null);
  release(); await delay(0);
  assert.equal(h.context.peekCommunityMediaUrl('slow1'), null, 'late success cannot rewrite cache');
  assert.equal(await h.resolve('recovered'), 'https://host/recovered', 'slots recover after settlement');
  h = harness(() => ({ data: [] }), () => { throw new Error('denied'); });
  assert.equal(await h.resolve('denied'), null);
  assert.equal(await h.resolve('denied'), null);
  assert.equal(h.stats.calls.length, 1, 'negative cache suppresses repeated failed requests');
  assert.equal(h.stats.active, 0);
  console.log('PASS: partial and failed batches, global max=3, timeout slot retention, late-result isolation, recovery, negative cache');
})().catch(error => { console.error(error); process.exitCode = 1; });
