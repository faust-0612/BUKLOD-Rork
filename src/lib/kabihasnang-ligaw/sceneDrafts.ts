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
