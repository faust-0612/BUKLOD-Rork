const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync('release/bible-matthew-henry-staging-132-20261116.json', 'utf8'));
const app = require('../app.config.js')({config:{}});
const eas = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
const reader = fs.readFileSync('src/app/bible/read.tsx', 'utf8');
const provider = fs.readFileSync('src/lib/buklodBibleStudy.ts', 'utf8');
const translation = fs.readFileSync('src/lib/buklodHenryTranslation.ts', 'utf8');
const nativeModule = fs.readFileSync('modules/buklod-mlkit-translation/expo-module.config.json', 'utf8');

test('staging OTA identity is Android staging-user preview/runtime 1.3.2, no production', () => {
  assert.equal(app.android.package, manifest.target.packageId);
  assert.equal(app.runtimeVersion, manifest.target.runtimeVersion);
  assert.equal(app.extra.appEnvironment, 'staging');
  assert.equal(app.extra.appTarget, 'main');
  assert.equal(app.extra.eas.projectId, manifest.target.easProjectId);
  assert.equal(eas.build['staging-user'].channel, manifest.target.channel);
  assert.equal(eas.build['staging-user'].environment, manifest.target.environment);
  assert.equal(eas.build.production.channel, 'production');
  assert.notEqual(eas.build.production.channel, manifest.target.channel);
});

test('Matthew Henry source uses bounded, account-aware optional study data', () => {
  assert.match(reader, /enabled: isMyBibleMode/);
  assert.match(provider, /getOfflineCache/);
  assert.match(provider, /setOfflineCache/);
  assert.match(provider, /parseMatthewHenryPassages/);
  assert.match(reader, /getMatthewHenryPassage\(bibleStudy, Number\(verse.verse_no\)\)/);
  assert.match(reader, /relation === 'context'/);
  assert.match(translation, /getSupportedTranslationLanguages/);
  assert.match(translation, /translateText\(part, 'en', targetLanguage, true\)/);
  assert.match(nativeModule, /BuklodMlKitTranslationModule/);
});

test('release remains blocked until Google attribution and Expo native gates pass', () => {
  assert.equal(manifest.releaseRules.readyForOta, false);
  assert.equal(manifest.releaseRules.otaPublished, false);
  assert.equal(manifest.releaseRules.allowPromotionToProduction, false);
  assert.equal(manifest.releaseRules.allowNativeRebuild, false);
  assert.match(manifest.mandatoryGates.translationBranding, /HOLD/);
  assert.match(manifest.mandatoryGates.installedNative, /HOLD/);
  assert.match(manifest.mandatoryGates.expoIdentity, /HOLD/);
});
