const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = readFileSync('src/lib/buklodGlobalAdController.ts', 'utf8');
const noImports = source.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];\s*/gm, '');
const runnable = stripTypeScriptTypes(noImports, { mode: 'strip' })
  .replace(/^export\s+(?=(?:async\s+)?function|const|let|class)/gm, '');

function makeController() {
  const data = new Map();
  let resetFails = false;
  const AsyncStorage = {
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      if (resetFails && value === '0') throw Error('storage reset unavailable');
      data.set(key, String(value));
    },
  };
  const sourceWithExports = runnable +
    '\n({setBuklodAdRoute, canWarmBuklodFullScreenAd, reserveBuklodFullScreenAd, finishBuklodFullScreenAd, getBuklodGlobalAdSafetySnapshot, acquireBuklodAdSafetyLock})';
  const controller = vm.runInNewContext(sourceWithExports, {
    AsyncStorage,
    Platform: { OS: 'android' },
    INTERSTITIAL_MIN_EVENT_COUNT: 2,
    AD_SLOT_REMOUNT_COOLDOWN_MS: 120000,
    Date: { now: () => 1000 },
    Math,
    String,
    Number,
    Object,
    Promise,
  }, { filename: 'buklodGlobalAdController.js' });
  controller.setBuklodAdRoute('/buklod');
  return { controller, data, failReset: () => { resetFails = true; } };
}

test('At least two eligible completed stages are required between consecutive fullscreen ads, with no time cooldown or session quota', async () => {
  const { controller: c, data } = makeController();
  for (let i = 0; i < 9; i++) {
    assert.equal(await c.reserveBuklodFullScreenAd('reading_session_completed', 'interstitial_bible_chapter_completed'), false);
    assert.equal(await c.reserveBuklodFullScreenAd('reading_session_completed', 'interstitial_bible_chapter_completed'), true);
    assert.equal(await c.reserveBuklodFullScreenAd('reading_session_completed', 'interstitial_bible_chapter_completed'), false, 'cannot reserve a second fullscreen while the first is active');
    await c.finishBuklodFullScreenAd(true);
    assert.equal(data.get('@buklod/ad/interstitial-count'), '0');
  }
  assert.equal(c.getBuklodGlobalAdSafetySnapshot().fullScreenShownThisSession, 9);
});

test('Concurrent completion callbacks cannot bypass cadence with duplicate reservations', async () => {
  const { controller: c } = makeController();
  const [first, second] = await Promise.all([
    c.reserveBuklodFullScreenAd('lesson_completed', 'interstitial_lesson_completed'),
    c.reserveBuklodFullScreenAd('lesson_completed', 'interstitial_lesson_completed'),
  ]);
  assert.equal(first, false);
  assert.equal(second, false);
  assert.equal(await c.reserveBuklodFullScreenAd('lesson_completed', 'interstitial_lesson_completed'), true);
  await c.finishBuklodFullScreenAd(true);
});

test('Sensitive routes, active typing and failed durable reset prevent unsafe fullscreens', async () => {
  const { controller: c, failReset } = makeController();
  c.setBuklodAdRoute('/quiz');
  assert.equal(c.canWarmBuklodFullScreenAd('interstitial_lesson_completed'), false);
  c.setBuklodAdRoute('/buklod');
  const unlock = c.acquireBuklodAdSafetyLock('typing');
  assert.equal(c.canWarmBuklodFullScreenAd('interstitial_lesson_completed'), false);
  unlock();
  assert.equal(await c.reserveBuklodFullScreenAd('lesson_completed', 'interstitial_lesson_completed'), false);
  assert.equal(await c.reserveBuklodFullScreenAd('lesson_completed', 'interstitial_lesson_completed'), true);
  failReset();
  await c.finishBuklodFullScreenAd(true);
  assert.equal(c.getBuklodGlobalAdSafetySnapshot().fullScreenCadencePersistenceFailed, true);
  assert.equal(c.canWarmBuklodFullScreenAd('interstitial_lesson_completed'), false);
});
