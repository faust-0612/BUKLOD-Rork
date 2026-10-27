/** Keep each illustration's saved placement/effect independent of other scenes. */
export type SceneEffect = 'none' | 'rain' | 'fog' | 'fireflies' | 'embers' | 'lightning';
export type SceneDraft = { anchor: string; side: 'before' | 'after'; effect: SceneEffect; intensity: number };
export type SceneDirty = Record<number, { anchor?: boolean; effect?: boolean }>;
export type SavedScene = {
  kind: string;
  placement: number;
  anchor?: string | null;
  side?: 'before' | 'after' | null;
  effect?: SceneEffect | null;
  intensity?: number | null;
};

export const emptyScene = (): SceneDraft => ({ anchor: '', side: 'after', effect: 'none', intensity: 30 });

export function reconcileSceneDrafts(
  previous: Record<number, SceneDraft>,
  media: SavedScene[],
  dirty: SceneDirty,
): Record<number, SceneDraft> {
  const next = { ...previous };
  for (const item of media) {
    if (item.kind !== 'illustration' || item.placement < 1 || item.placement > 3) continue;
    const edits = dirty[item.placement] ?? {};
    const old = previous[item.placement] ?? emptyScene();
    next[item.placement] = {
      anchor: edits.anchor ? old.anchor : item.anchor ?? '',
      side: edits.anchor ? old.side : item.side ?? 'after',
      effect: edits.effect ? old.effect : item.effect ?? 'none',
      intensity: edits.effect ? old.intensity : item.intensity ?? 30,
    };
  }
  return next;
}
