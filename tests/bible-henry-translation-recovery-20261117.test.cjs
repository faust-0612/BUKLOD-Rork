const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const translation = fs.readFileSync('src/lib/buklodHenryTranslation.ts', 'utf8');
const reader = fs.readFileSync('src/app/bible/read.tsx', 'utf8');

const classifierSource = translation.slice(
  translation.indexOf('export function classifyHenryTranslationError'),
  translation.indexOf('\nfunction textFingerprint('),
);
assert.ok(classifierSource.startsWith('export function'), 'classifier must exist');
const classifierJs = stripTypeScriptTypes(classifierSource, { mode: 'strip' }).replace(/^export /gm, '');
const classify = vm.runInNewContext(classifierJs + '\nclassifyHenryTranslationError;', {});

test('native APK incompatibility is distinct from retryable Wi-Fi model failures', () => {
  assert.equal(classify({ message: 'BUKLOD ML Kit Translation is not available in this native build.' }), 'native-unavailable');
  assert.equal(classify({ code: 'E_MLKIT_MODEL', message: 'model download failed' }), 'model-unavailable');
  assert.equal(classify({ code: 'E_MLKIT_MODEL_DOWNLOAD' }), 'model-unavailable');
  assert.equal(classify({ message: 'Unsupported on-device commentary language' }), 'unsupported-language');
});

test('citation and semantic rejection still fails closed to original English', () => {
  assert.equal(classify({ message: 'Commentary translation failed semantic/citation safeguards' }), 'quality-rejected');
  assert.equal(classify({ code: 'E_MLKIT_TRANSLATE' }), 'translation-failed');
  assert.match(translation, /isHenryFilipinoTranslationReliable\(text, output\)/);
  assert.match(reader, /henryTranslation\.text : henryPassage\?\.text/);
  assert.match(reader, /Hindi nakabuo ng maaasahang salin/);
});

test('retry forces a new attempt without changing source fingerprint, cached successes, or Wi-Fi safeguard', () => {
  assert.match(reader, /setHenryRetryToken\(value => value \+ 1\)/);
  assert.match(reader, /retryToken: henryRetryToken/);
  assert.match(translation, /retryToken\?: number/);
  assert.match(translation, /\[enabled, accountId, key, text, targetLanguage, retryToken\]/);
  assert.match(translation, /getOfflineCache/);
  assert.match(translation, /setOfflineCache\(key, \{text: output\}/);
  assert.match(translation, /translateText\(part, 'en', targetLanguage, true\)/);
  assert.match(reader, /Kailangan ng APK update na may ML Kit/);
  assert.match(reader, /Kumonekta sa Wi-Fi at subukan muli/);
});

test('staging-user APK source includes on-device ML Kit module without changing production identity', () => {
  const config = JSON.parse(fs.readFileSync('eas.json', 'utf8'));
  const stage = config.build['staging-user'];
  assert.equal(stage.channel, 'staging-user');
  assert.equal(stage.environment, 'preview');
  assert.equal(stage.android.buildType, 'apk');
  assert.equal(stage.env.APP_VARIANT, 'staging');
  const native = fs.readFileSync('modules/buklod-mlkit-translation/android/src/main/java/org/mzbministry/buklod/mlkittranslation/BuklodMlKitTranslationModule.kt', 'utf8');
  const registration = JSON.parse(fs.readFileSync('modules/buklod-mlkit-translation/expo-module.config.json', 'utf8'));
  assert.match(native, /Name\(\s*["']BuklodMlKitTranslation["']\s*\)/);
  assert.ok(registration.android.modules.includes('org.mzbministry.buklod.mlkittranslation.BuklodMlKitTranslationModule'));
  assert.match(native, /downloadModelIfNeeded/);
  assert.match(reader, /Kailangan ng APK update na may ML Kit/);
});
