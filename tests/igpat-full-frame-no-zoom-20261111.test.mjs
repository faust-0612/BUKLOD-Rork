import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_IGPAT_QUICK_EDIT,
  parseIgpatQuickEdit,
  isDefaultIgpatQuickEdit,
  suggestIgpatAutoImprove,
  serializeIgpatQuickEdit,
} from '../src/lib/igpat/quickEdit.ts';

const read = path => readFileSync(path, 'utf8');

test('new and legacy-absent IGPAT fit preserves every pixel without cropping', () => {
  assert.equal(DEFAULT_IGPAT_QUICK_EDIT.contentFit, 'contain');
  assert.equal(parseIgpatQuickEdit(null, 60).contentFit, 'contain');
  assert.equal(parseIgpatQuickEdit({}, 60).contentFit, 'contain');
  assert.equal(parseIgpatQuickEdit({ speed: 1.25 }, 60).contentFit, 'contain');
  assert.equal(isDefaultIgpatQuickEdit(DEFAULT_IGPAT_QUICK_EDIT, 60), true);
});

test('auto improve cannot silently zoom/crop even when suggesting a cover timestamp', () => {
  const suggested = suggestIgpatAutoImprove(
    { ...DEFAULT_IGPAT_QUICK_EDIT, trimStartSeconds: 0, trimEndSeconds: 30 },
    30,
  );
  assert.equal(suggested.edit.contentFit, 'contain');
  assert.equal(suggested.edit.coverSeconds, 15);
  assert.ok(!suggested.changes.some(x => /cropp|9:16 framing/i.test(x)));
});

test('explicit crop edit stays editable and serialized without changing default source framing', () => {
  const explicit = { ...DEFAULT_IGPAT_QUICK_EDIT, contentFit: 'cover' };
  const serialized = serializeIgpatQuickEdit(explicit, 60);
  assert.equal(serialized.content_fit, 'cover');
  assert.equal(parseIgpatQuickEdit(serialized, 60).contentFit, 'cover');
  assert.equal(isDefaultIgpatQuickEdit(explicit, 60), false);
  assert.equal(serializeIgpatQuickEdit(DEFAULT_IGPAT_QUICK_EDIT, 60).content_fit, 'contain');
});

test('IGPAT feed and Home previews never use cover as automatic default', () => {
  const native = read('src/app/igpat/index.tsx');
  const web = read('src/app/igpat/index.web.tsx');
  const home = read('src/components/BuklodHomeReelsExtension.tsx');
  const inlineAndroid = read('src/components/BuklodCommunityIgpatPreview.android.tsx');
  const inlineWeb = read('src/components/BuklodCommunityIgpatPreview.web.tsx');
  assert.match(native, /contentFit="contain"/);
  assert.match(web, /contentFit=\{hasEditMeta && edit\.contentFit === 'cover' \? 'cover' : 'contain'\}/);
  assert.match(home, /contentFit="contain"/);
  assert.match(inlineAndroid, /contentFit="contain"/);
  assert.match(inlineWeb, /contentFit="contain"/);
});

test('web editor defaults to full frame, differentiates manual crop and avoids zoomed live camera', () => {
  const web = read('src/app/igpat/create.web.tsx');
  assert.match(web, /objectFit: normalized\.contentFit === 'cover' \? 'cover' : 'contain'/);
  assert.match(web, /'CROP TO FILL' : 'FIT FULL FRAME'/);
  assert.match(web, /Cropping happens only when you choose CROP TO FILL/);
  assert.match(web, /height: 380, objectFit: 'contain'/);
  assert.doesNotMatch(web, /height: 380, objectFit: 'cover'/);
});
