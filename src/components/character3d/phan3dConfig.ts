export const PHAN_3D_MODEL_ID = 'phan' as const;

export const PHAN_3D_ANIMATIONS = [
  'Idle',
  'Walk',
  'Wave',
  'Celebrate',
  'LevelUp',
  'LookAround',
  'Pose',
] as const;

export type Phan3DAnimation =
  (typeof PHAN_3D_ANIMATIONS)[number];

export type Phan3DQuality =
  | 'low'
  | 'medium'
  | 'high';

export type Phan3DAssetManifest = {
  modelId: typeof PHAN_3D_MODEL_ID;
  /** Web-served GLB URL. Keep the GLB immutable and cacheable. */
  modelUrl: string;
  /** Character level is independent per selected character. */
  level: number;
  /** Optional appearance/skin key for modular Phan outfits. */
  appearanceKey?: string;
  animations: readonly Phan3DAnimation[];
};

/**
 * Canonical contract for the reusable Phan rig.
 *
 * One base humanoid rig is reused for every Phan level. Level progression
 * changes appearance/outfit modules; it must not duplicate the skeleton or
 * animation clips. The model must preserve the approved Phan identity.
 */
export function createPhan3DManifest(
  level: number,
  modelUrl = '/characters/phan/phan.glb',
): Phan3DAssetManifest {
  const safeLevel = Math.max(
    1,
    Math.floor(Number.isFinite(level) ? level : 1),
  );

  return {
    modelId: PHAN_3D_MODEL_ID,
    modelUrl,
    level: safeLevel,
    appearanceKey: `phan-level-${safeLevel}`,
    animations: PHAN_3D_ANIMATIONS,
  };
}
