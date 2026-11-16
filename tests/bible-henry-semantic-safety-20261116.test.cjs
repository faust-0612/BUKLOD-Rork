const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const translation = fs.readFileSync('src/lib/buklodHenryTranslation.ts', 'utf8');
const reader = fs.readFileSync('src/app/bible/read.tsx', 'utf8');

test('Bible reader never presents a failed commentary translation as the authoritative source', () => {
  assert.match(reader, /henryTranslation\.status === 'translated'/);
  assert.match(reader, /henryTranslation\.text : henryPassage\?\.text/);
  assert.match(reader, /Hindi nakabuo ng maaasahang salin/);
  assert.match(reader, /Ihambing sa Original English/);
  assert.match(reader, /Original English/);
});

test('semantic and missing-citation safeguards run before account-scoped translation cache writes', () => {
  const guard = translation.indexOf('isHenryFilipinoTranslationReliable(text, output)');
  const write = translation.indexOf('setOfflineCache(key, {text: output}');
  assert.ok(guard > 0 && write > guard, 'quality check must precede cache write');
  assert.match(translation, /henry-translation-v4:/);
  assert.match(translation, /formatHenryBibleReferences\(english, 'en'\)/);
  assert.match(translation, /formatHenryBibleReferences\(filipino, 'tl'\)/);
  assert.match(translation, /for \(const match of source\.matchAll\(cite\)\)/);
  assert.match(translation, /show the authoritative English/);
});

test('Bible commentary translation is isolated from AdMob, global navigation and Scripture source', () => {
  assert.match(translation, /translateText\(part, 'en', targetLanguage, true\)/);
  assert.match(translation, /getOfflineCache/);
  assert.match(translation, /userId: accountId/);
  assert.match(reader, /https:\/\/translate\.google\.com\//);
});
