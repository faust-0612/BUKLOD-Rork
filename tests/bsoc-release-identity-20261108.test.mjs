import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Main Android OTA remains pinned to installed runtime 1.3.2, correct EAS identity and production channel', () => {
  const config = read('app.config.js');
  const eas = JSON.parse(read('eas.json'));
  assert.match(config, /'23dad7d0-389a-406e-8dec-08965dab85d8'/);
  assert.match(config, /'org\.mzbministry\.buklod'/);
  assert.match(config, /runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
  assert.equal(eas.build.production.channel, 'production');
  assert.equal(eas.build['staging-user'].channel, 'staging-user');
  assert.equal(eas.build.production.environment, 'production');
});

test('Standalone BSOC Expo Hosting deploy remains bound to its separate pinned source and Expo project', () => {
  const script = read('scripts/BUKLOD_BSOC_EXPO_WEB_PINNED_DEPLOY.ps1');
  assert.match(script, /BUKLOD-Migrated-Sources\.git/);
  assert.match(script, /55d08013-cf5c-4d4a-9ecb-8d9e8e21e62c/);
  assert.match(script, /buklod-bsoc/);
  assert.match(script, /Pinned source SHA mismatch/);
  assert.match(script, /Expo project:info does not match expected project ID/);
  assert.match(script, /if \(-not \$state\.published\) \{ exit 1 \}/);
});
