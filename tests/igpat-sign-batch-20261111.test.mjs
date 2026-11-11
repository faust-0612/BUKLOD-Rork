import test from 'node:test';
import assert from 'node:assert/strict';
// Node 22.23+ strips TypeScript annotations natively, even in the preinstall gate.
import { signIgpatRowsInBatch as signRows } from '../src/lib/igpat/signBatch.ts';
assert.equal(typeof signRows, 'function');

const rows = [
  { id: 'one', media_path: 'a/video.mp4' },
  { id: 'two', media_path: 'b/video.mp4' },
  { id: 'three', media_path: 'c/video.mp4' },
];

test('one batch signs returned paths rather than assuming response order; missing row safely falls back', async () => {
  let batches = 0;
  const individual = [];
  const result = await signRows(
    rows,
    async paths => {
      batches++;
      assert.equal(paths.length, 3);
      return { data: [
        { path: 'c/video.mp4', signedUrl: 'signed-c' },
        { path: 'other-user/secret.mp4', signedUrl: 'must-not-map' },
        { path: 'a/video.mp4', signedUrl: 'signed-a' },
        { path: 'b/video.mp4', error: 'not in this batch' },
      ] };
    },
    async row => {
      individual.push(row.media_path);
      return { ...row, media_url: 'signed-b' };
    },
    () => true,
  );
  assert.equal(batches, 1);
  assert.deepEqual(individual, ['b/video.mp4']);
  assert.deepEqual(Array.from(result, row => row.media_url), ['signed-a', 'signed-b', 'signed-c']);
  assert.deepEqual(Array.from(result, row => row.id), rows.map(row => row.id));
});

test('single failed batch uses at most two concurrent individual signs, no unbounded retries', async () => {
  let inFlight = 0;
  let peak = 0;
  let attempts = 0;
  const result = await signRows(
    rows,
    async () => { throw new Error('storage batch unavailable'); },
    async row => {
      attempts++;
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(resolve => setTimeout(resolve, 2));
      inFlight--;
      return { ...row, media_url: 'fallback-' + row.id };
    },
    () => true,
  );
  assert.equal(attempts, 3);
  assert.ok(peak <= 2, 'fallback must not saturate the network');
  assert.deepEqual(Array.from(result, row => row.media_url),
    ['fallback-one', 'fallback-two', 'fallback-three']);
});

test('stale or logged-out feed cancels fallback and cannot publish old private URLs', async () => {
  let active = true;
  let fallbackCount = 0;
  const result = await signRows(
    rows,
    async () => {
      active = false;
      return { data: [{ path: 'a/video.mp4', signedUrl: 'stale-credential' }] };
    },
    async row => { fallbackCount++; return row; },
    () => active,
  );
  assert.equal(fallbackCount, 0);
  assert.deepEqual(Array.from(result), []);
  const notStarted = await signRows(rows,
    async () => { throw Error('should not start'); },
    async row => row,
    () => false);
  assert.deepEqual(Array.from(notStarted), []);
});

test('duplicate paths use one signing request and per-row access failure finishes without spinner', async () => {
  const duplicated = [rows[0], { ...rows[0], id: 'repeat' }, rows[1]];
  let individualCalls = 0;
  const result = await signRows(
    duplicated,
    async paths => {
      assert.deepEqual(Array.from(paths), ['a/video.mp4', 'b/video.mp4']);
      return { data: [] };
    },
    async row => {
      individualCalls++;
      if (row.media_path === 'a/video.mp4') return { ...row, media_url: 'signed-a' };
      throw new Error('permission denied');
    },
    () => true,
  );
  assert.equal(individualCalls, 2);
  assert.deepEqual(Array.from(result, row => row.media_url), ['signed-a', 'signed-a', null]);
});

test('partial batch exposes authorized videos before a slow missing-path fallback', async () => {
  let completeFallback;
  const fallbackGate = new Promise(resolve => { completeFallback = resolve; });
  let reportPartial;
  const partialReceived = new Promise(resolve => { reportPartial = resolve; });
  const running = signRows(
    rows,
    async () => ({ data: [
      { path: 'c/video.mp4', signedUrl: 'ready-c' },
      { path: 'a/video.mp4', signedUrl: 'ready-a' },
    ] }),
    async row => {
      await fallbackGate;
      return { ...row, media_url: 'recovered-b' };
    },
    () => true,
    signedRows => reportPartial(Array.from(signedRows, row => [row.id, row.media_url])),
  );
  const early = await Promise.race([
    partialReceived,
    new Promise((_resolve, reject) =>
      setTimeout(() => reject(Error('partial URLs were held until fallback')), 1000)),
  ]);
  assert.deepEqual(early, [['one', 'ready-a'], ['three', 'ready-c']]);
  completeFallback();
  const done = await running;
  assert.deepEqual(Array.from(done, row => row.media_url),
    ['ready-a', 'recovered-b', 'ready-c']);
});
