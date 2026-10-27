import { reconcileSceneDrafts, type SavedScene } from '../src/lib/kabihasnang-ligaw/sceneDraftState';

const media: SavedScene[] = [
  { kind: 'illustration', placement: 1, anchor: 'A unique sentence for scene one.', side: 'before', effect: 'rain', intensity: 50 },
  { kind: 'illustration', placement: 2, anchor: 'A different sentence for scene two.', side: 'after', effect: 'fog', intensity: 30 },
  { kind: 'illustration', placement: 3, anchor: 'The third sentence belongs to scene three.', side: 'after', effect: 'lightning', intensity: 70 },
  { kind: 'music', placement: 0, anchor: null },
];

describe('KL independent scene drafts', () => {
  it('restores the correct saved anchor and effect for all three scenes', () => {
    const drafts = reconcileSceneDrafts({}, media, {});
    expect(drafts[1].anchor).toBe('A unique sentence for scene one.');
    expect(drafts[2].anchor).toBe('A different sentence for scene two.');
    expect(drafts[3].anchor).toBe('The third sentence belongs to scene three.');
    expect(drafts[1].effect).toBe('rain');
    expect(drafts[3].intensity).toBe(70);
  });

  it('preserves unsaved scene 2 edits while refreshing saved scene 1 and 3', () => {
    const initial = reconcileSceneDrafts({}, media, {});
    const editing = { ...initial, 2: { ...initial[2], anchor: 'Unsaved draft 2', effect: 'embers' as const } };
    const refreshed = reconcileSceneDrafts(editing, [
      { ...media[0], effect: 'fireflies' },
      { ...media[1], effect: 'fog' },
      media[2],
    ], { 2: { anchor: true, effect: true } });
    expect(refreshed[1].effect).toBe('fireflies');
    expect(refreshed[2].anchor).toBe('Unsaved draft 2');
    expect(refreshed[2].effect).toBe('embers');
    expect(refreshed[3].anchor).toBe(initial[3].anchor);
  });
});
