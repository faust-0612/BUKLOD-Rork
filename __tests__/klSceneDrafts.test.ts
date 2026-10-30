import { clearSceneDraft, sceneEditorValues, updateSceneDraft } from '../src/lib/kabihasnang-ligaw/sceneDrafts';

const media = [
  { kind: 'illustration', placement: 1, anchor: 'First unique manuscript passage.', side: 'after', effect: 'rain', intensity: 20 },
  { kind: 'illustration', placement: 2, anchor: 'Second unique manuscript passage.', side: 'before', effect: 'fog', intensity: 60 },
  { kind: 'illustration', placement: 3, anchor: 'Third unique manuscript passage.', side: 'after', effect: 'none', intensity: 0 },
];

describe('KL scene-specific edit state and saved placement restoration', () => {
  it('reopens the correct saved paragraph, side and atmosphere for each scene', () => {
    expect(sceneEditorValues(media, 1)).toEqual({
      anchor: 'First unique manuscript passage.', side: 'after', effect: 'rain', intensity: 20,
    });
    expect(sceneEditorValues(media, 2)).toEqual({
      anchor: 'Second unique manuscript passage.', side: 'before', effect: 'fog', intensity: 60,
    });
    expect(sceneEditorValues(media, 3)).toEqual({
      anchor: 'Third unique manuscript passage.', side: 'after', effect: 'none', intensity: 0,
    });
  });

  it('keeps pending edits isolated when switching back and forth between scenes', () => {
    let drafts = updateSceneDraft({}, 1, { anchor: 'Revised scene one paragraph' });
    drafts = updateSceneDraft(drafts, 2, { anchor: 'New scene two paragraph', side: 'after' });
    drafts = updateSceneDraft(drafts, 1, { effect: 'embers' });

    expect(sceneEditorValues(media, 1, drafts[1])).toMatchObject({
      anchor: 'Revised scene one paragraph', effect: 'embers', side: 'after',
    });
    expect(sceneEditorValues(media, 2, drafts[2])).toMatchObject({
      anchor: 'New scene two paragraph', side: 'after', effect: 'fog',
    });
    expect(sceneEditorValues(media, 3, drafts[3])).toEqual(sceneEditorValues(media, 3));
    expect(sceneEditorValues(media, 1, drafts[1]).anchor).not.toBe(sceneEditorValues(media, 2, drafts[2]).anchor);
  });

  it('clears only the replaced artwork draft and restores empty server defaults', () => {
    let drafts = updateSceneDraft({}, 1, { anchor: 'Editing one' });
    drafts = updateSceneDraft(drafts, 2, { anchor: 'Editing two' });
    const afterReplacement = media.map((item) => item.placement === 1
      ? { ...item, anchor: null, side: null, effect: 'none', intensity: 30 } : item);
    drafts = clearSceneDraft(drafts, 1);

    expect(sceneEditorValues(afterReplacement, 1, drafts[1])).toEqual({
      anchor: '', side: 'after', effect: 'none', intensity: 30,
    });
    expect(sceneEditorValues(afterReplacement, 2, drafts[2]).anchor).toBe('Editing two');
  });

  it('uses backend values on a new chapter mount, not the previous chapter state', () => {
    const nextChapter = [{ kind: 'illustration', placement: 1, anchor: 'Different chapter anchor.' }];
    expect(sceneEditorValues(nextChapter, 1).anchor).toBe('Different chapter anchor.');
    expect(sceneEditorValues(nextChapter, 2).anchor).toBe('');
  });
});
