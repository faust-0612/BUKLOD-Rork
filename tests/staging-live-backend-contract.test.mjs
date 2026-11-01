import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const config = readFileSync('app.config.js', 'utf8');
const eas = JSON.parse(readFileSync('eas.json', 'utf8'));
const file = JSON.parse(readFileSync('google-services.production.json','utf8'));
const native=readFileSync('src/components/BuklodOtaFreshnessHost.native.tsx','utf8');
const script=readFileSync('scripts/staging-user-live-backend-gate.cjs','utf8');

test('staging profile reads existing backend environment without native package or channel collision',()=>{
  const p=eas.build['staging-user'];
  assert.equal(p.environment,'production');
  assert.equal(p.channel,'staging-user');
  assert.equal(p.distribution,'internal');
  assert.equal(p.android.buildType,'apk');
  assert.equal(p.env.APP_VARIANT,'staging');
  assert.equal(p.autoIncrement,undefined);
  assert.equal(p.env.EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS,'false');
  assert.match(config,/versionCode:\s*isStaging && !isClassroom \? 1/);
  assert.equal(p.env.EXPO_PUBLIC_APP_ENV,'staging');
  assert.equal(eas.build.production.channel,'production');
  assert.equal(eas.build.production.environment,'production');
  assert.match(config,/org\.mzbministry\.buklod\.staging/);
  assert.match(config,/isStaging[\s\S]*'ca-app-pub-3940256099942544~3347511713'/);
});
test('existing Firebase project contains a registered staging Android client',()=>{
  const names=(file.client||[]).map(c=>c.client_info?.android_client_info?.package_name);
  assert.ok(names.includes('org.mzbministry.buklod'));
  assert.ok(names.includes('org.mzbministry.buklod.staging'));
  assert.match(config,/google-services.production.json/);
});
test('live-data staging visibility and exact production backend safeguard',()=>{
  assert.match(native,/BUKLOD STAGING · LIVE DATA · OTA/);
  assert.match(native,/Updates\.channel === 'staging-user'/);
  assert.match(script,/https:\/\/yhanxndaqbmuzbdqlblu\.supabase\.co/);
  assert.match(script,/org\.mzbministry\.buklod\.staging/);
  assert.match(script,/sb_secret_/);
});
