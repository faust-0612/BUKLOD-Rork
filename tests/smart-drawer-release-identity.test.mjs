import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const configure = require('../app.config.js');

function config(env) {
  const keys = ['APP_VARIANT','EXPO_PUBLIC_APP_ENV','BUKLOD_APP_TARGET'];
  const old = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key];
    Object.assign(process.env, env);
    return configure({ config: {} });
  } finally {
    for (const key of keys) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
}

test('Drawer OAuth client identity only matches production Android package', () => {
  const prod = config({ APP_VARIANT: 'production', BUKLOD_APP_TARGET: 'main' });
  assert.equal(prod.android.package, 'org.mzbministry.buklod');
  assert.equal(prod.extra.smartDrawerGoogleDriveAndroidClientId,
    '1042684297204-ttfqqj0bhqc3i2d10jco599tndtvc67k.apps.googleusercontent.com');
  assert.equal(prod.extra.smartDrawerGoogleDriveAndroidClientId.endsWith('.apps.googleusercontent.com'), true);
});

test('Drawer production OAuth ID never leaks into staging or Classroom', () => {
  assert.equal(config({ APP_VARIANT: 'staging' }).extra.smartDrawerGoogleDriveAndroidClientId, null);
  assert.equal(config({ BUKLOD_APP_TARGET: 'classroom' }).extra.smartDrawerGoogleDriveAndroidClientId, null);
});
