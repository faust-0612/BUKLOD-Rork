import test from 'node:test';
import assert from 'node:assert/strict';
import { createSilentOtaDownloader, OTA_CHECK_INTERVAL_MS, OTA_FAILURE_COOLDOWN_MS } from '../src/lib/buklodSilentOtaPolicy.ts';

test('launch does not duplicate Expo built-in OTA check, then downloads quietly', async () => {
  let clock = 1000, checks = 0, downloads = 0;
  const ota = createSilentOtaDownloader({
    now: () => clock,
    checkForUpdate: async () => { checks++; return { isAvailable: true }; },
    fetchUpdate: async () => { downloads++; return { isNew: true }; },
  });
  assert.equal(ota.isDue(), false);
  assert.equal(await ota.checkIfDue(), false);
  clock += OTA_CHECK_INTERVAL_MS;
  assert.equal(ota.isDue(), true);
  assert.equal(await ota.checkIfDue(), true);
  assert.equal(checks, 1);
  assert.equal(downloads, 1);
  clock += OTA_CHECK_INTERVAL_MS * 5;
  assert.equal(ota.isDue(), false, 'downloaded bundle waits for next cold start');
  assert.equal(await ota.checkIfDue(), false);
  assert.equal(checks, 1, 'no repeated fetch after bundle is ready');
});

test('network outage backs off silently without blocking later automatic recovery', async () => {
  let clock = 0, attempts = 0, downloads = 0;
  const ota = createSilentOtaDownloader({
    now: () => clock,
    checkForUpdate: async () => { attempts++; if (attempts === 1) throw Error('offline'); return { isAvailable: true }; },
    fetchUpdate: async () => { downloads++; return { isNew: true }; },
  });
  clock = OTA_CHECK_INTERVAL_MS;
  assert.equal(await ota.checkIfDue(), false);
  assert.equal(ota.isDue(), false);
  clock += OTA_FAILURE_COOLDOWN_MS - 1;
  assert.equal(await ota.checkIfDue(), false);
  assert.equal(attempts, 1);
  clock += 1;
  assert.equal(await ota.checkIfDue(), true);
  assert.equal(attempts, 2);
  assert.equal(downloads, 1);
});

test('foreground storms share a single in-flight check and download', async () => {
  let clock = 0, checks = 0, downloads = 0, complete;
  const hold = new Promise(resolve => { complete = resolve; });
  const ota = createSilentOtaDownloader({
    now: () => clock,
    checkForUpdate: async () => { checks++; await hold; return { isAvailable: true }; },
    fetchUpdate: async () => { downloads++; return { isNew: true }; },
  });
  clock = OTA_CHECK_INTERVAL_MS;
  const all = [ota.checkIfDue(), ota.checkIfDue(), ota.checkIfDue()];
  assert.equal(checks, 1);
  complete();
  assert.deepEqual(await Promise.all(all), [true, true, true]);
  assert.equal(downloads, 1);
});

test('no available update or non-new fetch honors normal throttle', async () => {
  let clock = 0, checks = 0, downloads = 0;
  const ota = createSilentOtaDownloader({
    now: () => clock,
    checkForUpdate: async () => ({ isAvailable: ++checks > 1 }),
    fetchUpdate: async () => { downloads++; return { isNew: false }; },
  });
  clock += OTA_CHECK_INTERVAL_MS;
  assert.equal(await ota.checkIfDue(), false);
  assert.equal(downloads, 0);
  assert.equal(await ota.checkIfDue(), false);
  clock += OTA_CHECK_INTERVAL_MS;
  assert.equal(await ota.checkIfDue(), false);
  assert.equal(checks, 2);
  assert.equal(downloads, 1);
});

test('failed download retries after cooldown instead of suppressing updates permanently', async () => {
  let clock = 0, downloads = 0;
  const ota = createSilentOtaDownloader({
    now: () => clock,
    checkForUpdate: async () => ({ isAvailable: true }),
    fetchUpdate: async () => { if (++downloads === 1) throw Error('weak connection'); return { isNew: true }; },
  });
  clock = OTA_CHECK_INTERVAL_MS;
  assert.equal(await ota.checkIfDue(), false);
  clock += OTA_FAILURE_COOLDOWN_MS;
  assert.equal(await ota.checkIfDue(), true);
  assert.equal(downloads, 2);
});
