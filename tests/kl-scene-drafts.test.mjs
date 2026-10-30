import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearSceneDraft, sceneEditorValues, updateSceneDraft } from '../src/lib/kabihasnang-ligaw/sceneDrafts.ts';

const media = [
  { kind: 'illustration', placement: 1, anchor: 'First unique manuscript passage.', side: 'after', effect: 'rain', intensity: 20 },
  { kind: 'illustration', placement: 2, anchor: 'Second unique manuscript passage.', side: 'before', effect: 'fog', intensity: 60 },
  { kind: 'illustration', placement: 3, anchor: 'Third unique manuscript passage.', side: 'after', effect: 'none', intensity: 0 },
];

test('each scene restores its own saved passage, side and effect from media RPC data', () => {
  assert.deepEqual(sceneEditorValues(media, 1), { anchor: 'First unique manuscript passage.', side: 'after', effect: 'rain', intensity: 20 });
  assert.deepEqual(sceneEditorValues(media, 2), { anchor: 'Second unique manuscript passage.', side: 'before', effect: 'fog', intensity: 60 });
  assert.deepEqual(sceneEditorValues(media, 3), { anchor: 'Third unique manuscript passage.', side: 'after', effect: 'none', intensity: 0 });
});

test('unsaved input is isolated by placement, including repeated scene switching', () => {
  let drafts = updateSceneDraft({}, 1, { anchor: 'Edited scene one' });
  drafts = updateSceneDraft(drafts, 2, { anchor: 'Edited scene two', side: 'after' });
  drafts = updateSceneDraft(drafts, 1, { effect: 'embers' });
  assert.deepEqual(sceneEditorValues(media, 1, drafts[1]), { anchor: 'Edited scene one', side: 'after', effect: 'embers', intensity: 20 });
  assert.deepEqual(sceneEditorValues(media, 2, drafts[2]), { anchor: 'Edited scene two', side: 'after', effect: 'fog', intensity: 60 });
  assert.deepEqual(sceneEditorValues(media, 3, drafts[3]), sceneEditorValues(media, 3));
  assert.notEqual(sceneEditorValues(media, 1, drafts[1]).anchor, sceneEditorValues(media, 2, drafts[2]).anchor);
});

test('new artwork invalidates only its scene draft and restores blank placement from server', () => {
  let drafts = updateSceneDraft({}, 1, { anchor: 'Unsaved 1' });
  drafts = updateSceneDraft(drafts, 2, { anchor: 'Unsaved 2' });
  const replaced = media.map(item => item.placement === 1
    ? { ...item, anchor: null, side: null, effect: 'none', intensity: 30 } : item);
  drafts = clearSceneDraft(drafts, 1);
  assert.deepEqual(sceneEditorValues(replaced, 1, drafts[1]), { anchor: '', side: 'after', effect: 'none', intensity: 30 });
  assert.equal(sceneEditorValues(replaced, 2, drafts[2]).anchor, 'Unsaved 2');
});

test('reopening another chapter reads its own server metadata with no prior scene draft', () => {
  const secondChapter = [{ kind: 'illustration', placement: 1, anchor: 'Another chapter passage.', side: 'after' }];
  assert.equal(sceneEditorValues(secondChapter, 1).anchor, 'Another chapter passage.');
  assert.equal(sceneEditorValues(secondChapter, 2).anchor, '');
});

test('zero intensity, empty explicit draft and unchanged scene remain intact', () => {
  assert.equal(sceneEditorValues(media, 3).intensity, 0);
  const drafts = updateSceneDraft({}, 3, { anchor: '' });
  assert.equal(sceneEditorValues(media, 3, drafts[3]).anchor, '');
  assert.equal(sceneEditorValues(media, 1).anchor, 'First unique manuscript passage.');
});
