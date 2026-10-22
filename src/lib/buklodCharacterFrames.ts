import {
  BASE_ASPECT,
  FACE_RIG,
  LAYER_PLACEMENTS,
  type LayerPlacement,
} from '@/lib/character-lab-core/assets';
import type { BodyId } from '@/lib/character-lab-core/types';

/** Percentage landmarks on the base body box. */
export type ReferenceLandmarks = {
  readonly headCenter: { readonly x: number; readonly y: number };
  readonly shoulderLine: number;
  readonly chestCenter: { readonly x: number; readonly y: number };
  readonly waistLine: number;
  readonly hipCenter: { readonly x: number; readonly y: number };
  readonly kneeLine: number;
  readonly ankleLine: number;
  readonly footBaseline: number;
};

export type ReferenceFrame = {
  readonly body: BodyId;
  readonly aspect: number;
  readonly landmarks: ReferenceLandmarks;
};

/** Per-item transform overrides saved from dev calibration. */
export type LayerTransformOverride = {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly anchorX: number;
  readonly anchorY: number;
};

export type BodyTransformOverrides = Partial<
  Record<string, LayerTransformOverride>
>;

function deriveLandmarks(body: BodyId): ReferenceLandmarks {
  const rig = FACE_RIG[body];
  const headCenterY = (rig.headTop + rig.chinY) / 2;
  const chestY = (rig.shoulderY + rig.waistY) / 2;
  const hipY = rig.waistY + (rig.feetY - rig.waistY) * 0.22;
  const kneeY = rig.waistY + (rig.feetY - rig.waistY) * 0.58;
  const ankleY = rig.feetY - (rig.feetY - rig.waistY) * 0.06;

  return {
    headCenter: { x: rig.headCenterX, y: headCenterY },
    shoulderLine: rig.shoulderY,
    chestCenter: { x: rig.bodyCenterX, y: chestY },
    waistLine: rig.waistY,
    hipCenter: { x: rig.bodyCenterX, y: hipY },
    kneeLine: kneeY,
    ankleLine: ankleY,
    footBaseline: rig.feetY,
  };
}

function buildReferenceFrame(body: BodyId): ReferenceFrame {
  return {
    body,
    aspect: BASE_ASPECT[body],
    landmarks: deriveLandmarks(body),
  };
}

export const FEMALE_REFERENCE_FRAME = buildReferenceFrame('female');
export const MALE_REFERENCE_FRAME = buildReferenceFrame('male');

export const REFERENCE_FRAMES: Record<BodyId, ReferenceFrame> = {
  female: FEMALE_REFERENCE_FRAME,
  male: MALE_REFERENCE_FRAME,
};

export function referenceFrameFor(body: BodyId): ReferenceFrame {
  return REFERENCE_FRAMES[body];
}

/** RN bottom correction — atlas hip slot uses 1.06×; waist-anchored scale-down. */
const BOTTOM_FEMALE_CORRECTION: LayerTransformOverride = {
  scale: 0.91,
  offsetX: 0,
  offsetY: 1.1,
  anchorX: 50,
  anchorY: 0,
};

const BOTTOM_MALE_CORRECTION: LayerTransformOverride = {
  scale: 0.93,
  offsetX: 0,
  offsetY: 0.9,
  anchorX: 50,
  anchorY: 0,
};

/** RN shoe tuning — bottom edge anchored to FACE_RIG.feetY via shoePlacementFor. */
const SHOE_FEMALE_SANDALS: LayerTransformOverride = {
  scale: 1,
  offsetX: -0.6,
  offsetY: 0,
  anchorX: 50,
  anchorY: 100,
};

const SHOE_FEMALE_BOOTS: LayerTransformOverride = {
  scale: 0.98,
  offsetX: 0,
  offsetY: 0,
  anchorX: 50,
  anchorY: 100,
};

const SHOE_FEMALE_GILDED: LayerTransformOverride = {
  scale: 0.98,
  offsetX: 0,
  offsetY: 0,
  anchorX: 50,
  anchorY: 100,
};

const SHOE_MALE_SANDALS: LayerTransformOverride = {
  scale: 1,
  offsetX: -1.2,
  offsetY: 0,
  anchorX: 50,
  anchorY: 100,
};

const SHOE_MALE_BOOTS: LayerTransformOverride = {
  scale: 0.98,
  offsetX: 2.3,
  offsetY: 0,
  anchorX: 50,
  anchorY: 100,
};

const SHOE_MALE_GILDED: LayerTransformOverride = {
  scale: 0.97,
  offsetX: 0,
  offsetY: 0,
  anchorX: 50,
  anchorY: 100,
};

/** Default per-body manifest overrides derived from atlas + FACE_RIG. */
export const DEFAULT_BODY_TRANSFORMS: Record<
  BodyId,
  BodyTransformOverrides
> = {
  female: {
    bottom_f_wrap: BOTTOM_FEMALE_CORRECTION,
    bottom_f_long: BOTTOM_FEMALE_CORRECTION,
    bottom_f_greaves: BOTTOM_FEMALE_CORRECTION,
    shoes_f_sandals: SHOE_FEMALE_SANDALS,
    shoes_f_boots: SHOE_FEMALE_BOOTS,
    shoes_f_gilded: SHOE_FEMALE_GILDED,
  },
  male: {
    bottom_m_wrap: BOTTOM_MALE_CORRECTION,
    bottom_m_long: BOTTOM_MALE_CORRECTION,
    bottom_m_greaves: BOTTOM_MALE_CORRECTION,
    shoes_m_sandals: SHOE_MALE_SANDALS,
    shoes_m_boots: SHOE_MALE_BOOTS,
    shoes_m_gilded: SHOE_MALE_GILDED,
  },
};

/** Bottom layers scaled from top-center waist anchor (atlas top edge). */
export function bottomPlacementFor(
  _assetKey: string,
  _body: BodyId,
  placement: LayerPlacement,
  override?: LayerTransformOverride | null
): LayerPlacement {
  const scale = override?.scale ?? 1;
  const offsetX = override?.offsetX ?? 0;
  const offsetY = override?.offsetY ?? 0;

  const scaledWidth = placement.width * scale;
  const scaledHeight = placement.height * scale;
  const centerX = placement.left + placement.width / 2;

  return {
    left: centerX - scaledWidth / 2 + offsetX,
    top: placement.top + offsetY,
    width: scaledWidth,
    height: scaledHeight,
  };
}

/** Shoe layers anchored to footBaseline from FACE_RIG.feetY. */
export function shoePlacementFor(
  assetKey: string,
  body: BodyId,
  placement: LayerPlacement,
  override?: LayerTransformOverride | null
): LayerPlacement {
  const frame = referenceFrameFor(body);
  const footBaseline = frame.landmarks.footBaseline;
  const scale = override?.scale ?? 1;
  const offsetX = override?.offsetX ?? 0;
  const offsetY = override?.offsetY ?? 0;

  const scaledWidth = placement.width * scale;
  const scaledHeight = placement.height * scale;
  const centerX = placement.left + placement.width / 2;
  const top = footBaseline - scaledHeight + offsetY;

  return {
    left: centerX - scaledWidth / 2 + offsetX,
    top,
    width: scaledWidth,
    height: scaledHeight,
  };
}

export function mergedTransform(
  body: BodyId,
  assetKey: string,
  calibration?: LayerTransformOverride | null
): LayerTransformOverride | null {
  const defaults = DEFAULT_BODY_TRANSFORMS[body]?.[assetKey];
  if (!defaults && !calibration) return null;
  return {
    scale: calibration?.scale ?? defaults?.scale ?? 1,
    offsetX: (defaults?.offsetX ?? 0) + (calibration?.offsetX ?? 0),
    offsetY: (defaults?.offsetY ?? 0) + (calibration?.offsetY ?? 0),
    anchorX: calibration?.anchorX ?? defaults?.anchorX ?? 50,
    anchorY: calibration?.anchorY ?? defaults?.anchorY ?? 50,
  };
}

export function layerPlacementWithOverride(
  assetKey: string,
  body: BodyId,
  calibration?: LayerTransformOverride | null
): LayerPlacement | null {
  const placement = LAYER_PLACEMENTS[assetKey];
  if (!placement) return null;

  const override = mergedTransform(body, assetKey, calibration);

  if (assetKey.startsWith('shoes_')) {
    return shoePlacementFor(assetKey, body, placement, override);
  }

  if (assetKey.startsWith('bottom_')) {
    return bottomPlacementFor(assetKey, body, placement, override);
  }

  if (!override) return placement;

  const scale = override.scale ?? 1;
  return {
    left: placement.left + (override.offsetX ?? 0),
    top: placement.top + (override.offsetY ?? 0),
    width: placement.width * scale,
    height: placement.height * scale,
  };
}

/**
 * Production compositor placement — DEFAULT_BODY_TRANSFORMS always applied;
 * optional dev calibration merges on top via mergedTransform.
 */
export function resolveLayerPlacement(
  assetKey: string,
  body: BodyId,
  calibration?: LayerTransformOverride | null
): LayerPlacement | null {
  return layerPlacementWithOverride(assetKey, body, calibration);
}
