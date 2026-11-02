/** Each KL illustration has its own saved anchor and atmosphere, keyed by scene placement. */
export type SceneValues = {
  anchor: string;
  side: 'before' | 'after';
  effect: string;
  intensity: number;
};
export type SceneDraft = Partial<SceneValues>;
export type SceneDrafts = Partial<Record<number, SceneDraft>>;
export type SceneRecord = {
  kind: string;
  placement: number;
  anchor?: string | null;
  side?: string | null;
  effect?: string | null;
  intensity?: number | null;
};

/** Drafts override only fields edited in the current scene, never neighboring scenes. */
export function sceneEditorValues(
  media: readonly SceneRecord[],
  placement: number,
  draft?: SceneDraft,
): SceneValues {
  const saved = media.find((item) => item.kind === 'illustration' && item.placement === placement);
  return {
    anchor: draft?.anchor ?? saved?.anchor ?? '',
    side: draft?.side ?? (saved?.side === 'before' ? 'before' : 'after'),
    effect: draft?.effect ?? saved?.effect ?? 'none',
    intensity: draft?.intensity ?? saved?.intensity ?? 30,
  };
}

export function updateSceneDraft(
  drafts: SceneDrafts,
  placement: number,
  changes: SceneDraft,
): SceneDrafts {
  return { ...drafts, [placement]: { ...drafts[placement], ...changes } };
}

export function clearSceneDraft(drafts: SceneDrafts, placement: number): SceneDrafts {
  const updated = { ...drafts };
  delete updated[placement];
  return updated;
}

/** Bounded, dynamic scene slots. Existing uploaded scenes survive editor reopens. */
export const KL_INITIAL_SCENE_COUNT = 3;
export const KL_MAX_SCENE_COUNT = 12;

export function klSceneNumbers(
  media: readonly SceneRecord[],
  visibleCount = KL_INITIAL_SCENE_COUNT,
): number[] {
  const savedMax = media.reduce((max, item) =>
    item.kind === 'illustration' && Number.isInteger(item.placement)
      && item.placement > 0 ? Math.max(max, item.placement) : max, 0);
  const count = Math.min(KL_MAX_SCENE_COUNT,
    Math.max(KL_INITIAL_SCENE_COUNT, visibleCount, savedMax));
  return Array.from({ length: count }, (_, i) => i + 1);
}

export function nextKlSceneCount(
  media: readonly SceneRecord[],
  visibleCount: number,
): number {
  return Math.min(KL_MAX_SCENE_COUNT, klSceneNumbers(media, visibleCount).length + 1);
}
