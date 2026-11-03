import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('Returning users start the SDK from prior valid consent before UMP refresh completes', () => {
  const admob = read('src/lib/adMob.ts');
  const provider = read('src/providers/AdsProvider.tsx');
  assert.match(admob, /if \(previousConsent\.canRequestAds\)/);
  assert.match(admob, /consentRefreshPending: true/);
  assert.match(admob, /await gatherConsentOnce\(\)/);
  assert.match(provider, /result\.consentRefreshPending/);
  assert.match(provider, /refreshBuklodAdConsent\(\)/);
  assert.doesNotMatch(provider, /setTimeout\(/);
});

test('First-run consent remains fail-closed and concurrent startup calls share one bootstrap', () => {
  const admob = read('src/lib/adMob.ts');
  assert.match(admob, /consentRefreshPromise/);
  assert.match(admob, /startupPromise/);
  assert.match(admob, /previousConsent\.canRequestAds/);
  assert.match(admob, /First-run \/ unresolved consent remains fail-closed/);
  assert.match(admob, /const consentInfo = await AdsConsent\.getConsentInfo\(\)/);
});
