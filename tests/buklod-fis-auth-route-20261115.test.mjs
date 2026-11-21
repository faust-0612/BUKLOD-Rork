import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const index = readFileSync('src/app/index.tsx', 'utf8');
const login = readFileSync('src/app/(auth)/login.tsx', 'utf8');
const fis = readFileSync('src/app/admin/fis.tsx', 'utf8');
const DUMMY = 'de578117-37fb-4c4d-8fec-d472e08b117f';

function config(overrides) {
  const code = "process.stdout.write(JSON.stringify(require('./app.config.js')({config:{extra:{}}})))";
  return JSON.parse(execFileSync(process.execPath, ['-e', code], {
    cwd: process.cwd(), encoding: 'utf8',
    env: { ...process.env, BUKLOD_APP_TARGET: 'fis', EAS_PROJECT_ID_FIS: DUMMY,
      EXPO_PUBLIC_BUKLOD_FIS: '1', ...overrides },
    stdio: ['ignore','pipe','pipe'],
  }));
}

test('Normal BUKLOD Main identity is unaffected by FIS web flags', () => {
  const main = config({ BUKLOD_APP_TARGET: 'main', EXPO_PUBLIC_BUKLOD_FIS: '0', EAS_PROJECT_ID_FIS: '' });
  assert.equal(main.name, 'BUKLOD');
  assert.equal(main.slug, 'buklod');
  assert.equal(main.extra.eas.projectId, '23dad7d0-389a-406e-8dec-08965dab85d8');
  assert.equal(main.runtimeVersion, '1.3.2');
});

test('FIS configuration is isolated and defaults to deny when ID is absent', () => {
  const fisConfig = config({});
  assert.equal(fisConfig.name, 'BUKLOD FIS');
  assert.equal(fisConfig.owner, 'faust_0612');
  assert.equal(fisConfig.slug, 'buklod-fis');
  assert.equal(fisConfig.extra.appTarget, 'fis');
  assert.equal(fisConfig.extra.eas.projectId, DUMMY);
  assert.notEqual(fisConfig.extra.eas.projectId, '23dad7d0-389a-406e-8dec-08965dab85d8');
  assert.throws(() => config({ EAS_PROJECT_ID_FIS: '' }));
  assert.throws(() => config({ EAS_PROJECT_ID_FIS: '23dad7d0-389a-406e-8dec-08965dab85d8' }));
  assert.throws(() => config({ EAS_PROJECT_ID_FIS: 'cc69b3c0-a5df-4b69-a84c-887c36242fdd' }));
});

test('FIS hosting is pinned to the newly created dedicated Expo project', () => {
  assert.equal(config({}).extra.eas.projectId, DUMMY);
  assert.throws(() => config({ EAS_PROJECT_ID_FIS: '' }));
  assert.throws(() => config({ EAS_PROJECT_ID_FIS: '123e4567-e89b-42d3-a456-426614174000' }));
  assert.throws(() => config({ EAS_PROJECT_ID_FIS: '', BUKLOD_FIS_PROJECT_BOOTSTRAP: '1', CI: '1' }));
});

test('FIS login and landing route are conditional, protected and do not replace Main flow', () => {
  assert.match(index, /EXPO_PUBLIC_BUKLOD_FIS === '1'/);
  assert.ok(index.includes('<Redirect href="/admin/fis" />'));
  assert.match(login, /EXPO_PUBLIC_BUKLOD_FIS === '1'/);
  assert.ok(login.includes("'/(tabs)/buklod'"));
  assert.ok(fis.includes('<AdminGate>'));
  assert.ok(fis.includes('loadCanonicalAdminEconomy'));
});
