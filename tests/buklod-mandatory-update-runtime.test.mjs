import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(p, 'utf8');

test('Server retains authority for version cutoff and foreground refresh has throttle', () => {
 const s = read('src/providers/RuntimeConfigProvider.tsx');
 assert.match(s, /supabase.rpc\('get_client_runtime_config'/);
 assert.match(s, /RUNTIME_CONFIG_FRESH_MS = 2 \* 60 \* 1000/);
 assert.match(s, /AppState.addEventListener\('change'/);
 assert.match(s, /lastForegroundRefreshAt\.current < RUNTIME_CONFIG_FRESH_MS/);
 assert.match(s, /Platform.OS === 'web'\s*\? '999.999.999'/);
});

test('EAS OTA quietly downloads on foreground checks without a restart prompt or live reload', () => {
 const host = read('src/components/BuklodOtaFreshnessHost.native.tsx');
 const policy = read('src/lib/buklodSilentOtaPolicy.ts');
 assert.match(host, /createSilentOtaDownloader/);
 assert.match(host, /Updates.checkForUpdateAsync/);
 assert.match(host, /Updates.fetchUpdateAsync/);
 assert.match(policy, /OTA_CHECK_INTERVAL_MS = 60 \* 60 \* 1000/);
 assert.match(policy, /OTA_FAILURE_COOLDOWN_MS = 30 \* 60 \* 1000/);
 assert.doesNotMatch(host, /Updates.reloadAsync|I-restart|Mamaya|Pressable/);
 assert.match(host, /AppState.currentState === 'active'/);
});

test('Existing built-in Expo launch behavior and mandatory APK gate stay intact', () => {
 const config = read('app.config.js');
 assert.match(config, /fallbackToCacheTimeout: 0/);
 assert.match(config, /runtimeVersion: isClassroom \? '1.3.0' : '1.3.2'/);
 const scope = JSON.parse(read('.buklod/scopes/mandatory-android-update-20261101.json'));
 assert.match(scope.productionBaselineEvidence, /minimum_supported_version=1\.0\.0/);
 assert.ok(scope.acceptanceChecks.some(s => s.includes('DO NOT')));
});
