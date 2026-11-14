'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cfg = require('../app.config.js');
const eas = require('../eas.json');

const root = path.resolve(__dirname, '..');
const nativePackage = 'org.mzbministry.buklod.nativeqa';
const oldStagingPackage = 'org.mzbministry.buklod.staging';
const productionPackage = 'org.mzbministry.buklod';

function appFor(variant) {
  const old = { APP_VARIANT: process.env.APP_VARIANT, EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV, BUKLOD_APP_TARGET: process.env.BUKLOD_APP_TARGET };
  try {
    process.env.APP_VARIANT = variant;
    process.env.EXPO_PUBLIC_APP_ENV = variant === 'production' ? 'production' : 'staging';
    process.env.BUKLOD_APP_TARGET = 'main';
    return cfg({config: {extra: {}}});
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('native QA is a separately installable app with unique runtime, channel, scheme, Firebase config and test ads', () => {
  const lab = appFor('native-lab');
  const staging = appFor('staging');
  const prod = appFor('production');
  const profile = eas.build['native-lab'];
  assert.equal(lab.name, 'BUKLOD Native QA');
  assert.equal(lab.android.package, nativePackage);
  assert.equal(lab.ios.bundleIdentifier, nativePackage);
  assert.equal(lab.scheme, 'buklod-nativeqa');
  assert.equal(lab.runtimeVersion, '1.4.0-nativeqa.1');
  assert.equal(lab.extra.appEnvironment, 'staging');
  assert.equal(lab.extra.nativeLab, true);
  assert.equal(lab.extra.appTarget, 'main');
  assert.equal(lab.android.googleServicesFile, './google-services.native-lab.json');
  assert.equal(lab.android.versionCode, undefined);
  assert.equal(lab.extra.eas.projectId, '23dad7d0-389a-406e-8dec-08965dab85d8');
  assert.equal(lab.updates.url, 'https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8');
  const adsPlugin = lab.plugins.find(p => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads');
  assert.equal(adsPlugin?.[1]?.androidAppId, 'ca-app-pub-3940256099942544~3347511713');
  assert.equal(profile.distribution, 'internal');
  assert.equal(profile.environment, 'preview');
  assert.equal(profile.channel, 'native-lab');
  assert.equal(profile.android.buildType, 'apk');
  assert.equal(profile.env.APP_VARIANT, 'native-lab');
  assert.equal(profile.env.EXPO_PUBLIC_APP_ENV, 'staging');
  assert.equal(profile.autoIncrement, true);
  assert.notEqual(lab.android.package, staging.android.package);
  assert.notEqual(lab.android.package, prod.android.package);
  assert.notEqual(profile.channel, eas.build['staging-user'].channel);
  assert.notEqual(profile.channel, eas.build.production.channel);
  assert.notEqual(lab.runtimeVersion, staging.runtimeVersion);
  assert.notEqual(lab.runtimeVersion, prod.runtimeVersion);
  assert.equal(staging.android.package, oldStagingPackage);
  assert.equal(staging.runtimeVersion, '1.3.2');
  assert.equal(prod.android.package, productionPackage);
  assert.equal(prod.runtimeVersion, '1.3.2');
  assert.equal(eas.build['staging-user'].channel, 'staging-user');
  assert.equal(eas.build.production.channel, 'production');
});

test('unverified native dependencies must default to a fail-closed new APK gate', () => {
  const gate = JSON.parse(fs.readFileSync(path.join(root,'release/native-lab-apk-20261115.json'), 'utf8'));
  assert.equal(gate.packageId, nativePackage);
  assert.equal(gate.runtimeVersion, '1.4.0-nativeqa.1');
  assert.equal(gate.channel, 'native-lab');
  assert.equal(gate.readyForBuild, false);
  assert.equal(gate.nativeGifCommitContentVerified, false);
  assert.equal(gate.googleDriveOAuthNativeVerified, false);
  assert.equal(gate.firebaseClientRegistered, false);
  assert.equal(gate.otaPublished, false);
  assert.equal(gate.productionPublished, false);
  assert.equal(gate.oldStagingModified, false);
});
