import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

test('compact banner provides a measurable viewport probe on first render', () => {
 const component = read('src/components/BuklodAdMobBanner.tsx');
 const viewport = read('src/lib/buklodAdViewport.ts');
 assert.match(viewport, /height >= 8/);
 assert.match(component, /compact\) \{[\s\S]*?style=\{styles.pendingShell\}/);
 assert.match(component, /minHeight: 12/);
 const first = read('src/components/BuklodFirstViewAd.tsx');
 assert.match(first, /requireViewport\s+showLabel/);
 assert.doesNotMatch(first, /requireViewport=\{false\}/);
});

test('BannerAd cannot mount until an actual shared cooldown reservation is granted', () => {
 const s = read('src/components/BuklodAdMobBanner.tsx');
 assert.match(s, /const mountBanner =\s*routeSafe && reservationReady &&/);
 assert.match(s, /reserveBuklodPassiveAdRequest\(stablePlacementId, requestKey\)/);
 assert.match(s, /getBuklodPassiveAdRequestWaitMs\(stablePlacementId, requestKey\)/);
 assert.match(s, /if \(!shouldRequest \|\| !reservationReady/);
 assert.doesNotMatch(s, /if \(!accepted\) \{\s*setFailed\(true\)/);
 const controller = read('src/lib/buklodGlobalAdController.ts');
 assert.match(controller, /export function getBuklodPassiveAdRequestWaitMs/);
 assert.match(controller, /previous \+ Math.max\(1_000, cooldownMs\) - Date.now\(\)/);
});

test('No-fill is not rapidly retried; a failed banner can recover after a quiet period', () => {
 const s = read('src/components/BuklodAdMobBanner.tsx');
 assert.match(s, /code.includes\('no-fill'\)/);
 assert.match(s, /if \(!online \|\| noFill \|\| attempt >= MAX_RETRIES\)/);
 assert.match(s, /Date.now\(\) - failedAt.current < AD_SLOT_REMOUNT_COOLDOWN_MS/);
 assert.match(s, /useFocusEffect\(/);
 assert.match(s, /AppState.addEventListener\('change'/);
 assert.match(s, /setReservationReady\(false\)/);
});
