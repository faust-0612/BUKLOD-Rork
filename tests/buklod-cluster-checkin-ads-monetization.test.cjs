const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = filename => fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
const ads = read('src/lib/buklodGlobalAdController.ts');
const review = read('src/app/clusters/home-checkin-review.tsx');
const priority = read('src/lib/buklodAdminPriority.ts');
const bridge = read('src/components/BuklodAdSafetyRouteBridge.tsx');

test('attendance approval is a sensitive no-fullscreen-ad route', () => {
  assert.match(ads, /'\/clusters\/home-checkin-review'/);
  assert.match(ads, /prefix => route === prefix \|\| route\.startsWith/);
  assert.match(bridge, /isBuklodAdRouteSensitive\(pathname\)/);
  assert.doesNotMatch(review, /showBuklodAdOpportunity|warmBuklodInterstitial|interstitial_generic/);
});

test('system-wide ad inventory and queue safety remain independent', () => {
  assert.match(ads, /'\/scope\/attendance'/);
  assert.match(ads, /'\/clusters\/manage'/);
  assert.match(ads, /'\/profile\/attendance-qr'/);
  assert.doesNotMatch(priority, /admin_get_buklod_home_checkin_queue_r3/);
  assert.match(bridge, /warmBuklodInterstitial\('interstitial_generic'\)/);
});
