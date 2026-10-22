/**
 * BUKLOD Character art contract.
 *
 * Production art must be authored in JOINT-LOCAL space:
 * each slot's (0, 0) is that part's pivot. The engine translates to the
 * pivot, rotates, and never rotates around the SVG viewBox origin.
 *
 * Do not bake world-space coordinates into slot artwork.
 */

export const RIG_VIEWBOX = { w: 260, h: 620 } as const;
export const RIG_ASPECT = RIG_VIEWBOX.w / RIG_VIEWBOX.h;

export type ArtSlotId =
  | 'HEAD'
  | 'NECK'
  | 'TORSO'
  | 'LEFT_UPPER_ARM'
  | 'LEFT_FOREARM'
  | 'LEFT_HAND'
  | 'RIGHT_UPPER_ARM'
  | 'RIGHT_FOREARM'
  | 'RIGHT_HAND'
  | 'LEFT_THIGH'
  | 'LEFT_LOWER_LEG'
  | 'LEFT_FOOT'
  | 'RIGHT_THIGH'
  | 'RIGHT_LOWER_LEG'
  | 'RIGHT_FOOT'
  | 'EYES_OPEN'
  | 'EYES_CLOSED'
  | 'MOUTH_NEUTRAL'
  | 'MOUTH_SMALL_OPEN'
  | 'MOUTH_MEDIUM_OPEN'
  | 'MOUTH_SMILE'
  | 'HAIR_BACK'
  | 'HAIR_FRONT'
  | 'TOP'
  | 'BOTTOM'
  | 'SHOES'
  | 'ACCESSORY';

export type JointId =
  | 'root'
  | 'torso'
  | 'head'
  | 'lShoulder'
  | 'lElbow'
  | 'lWrist'
  | 'rShoulder'
  | 'rElbow'
  | 'rWrist'
  | 'lHip'
  | 'lKnee'
  | 'lAnkle'
  | 'rHip'
  | 'rKnee'
  | 'rAnkle';

/** Local-space axis-aligned box, used by DEV overlay only. */
export type SlotBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BoneLengths = {
  head: number;
  neck: number;
  upperArm: number;
  forearm: number;
  hand: number;
  thigh: number;
  shin: number;
  foot: number;
};

/**
 * Joint rest pose in PARENT local space.
 * root.rest is in viewBox (world) coordinates.
 */
export type Skeleton = {
  viewBox: typeof RIG_VIEWBOX;
  /** One head-unit in viewBox pixels. Figure is ~7.3 heads. */
  headUnit: number;
  bones: BoneLengths;
  root: { x: number; y: number };
  torso: { x: number; y: number };
  head: { x: number; y: number };
  lShoulder: { x: number; y: number };
  rShoulder: { x: number; y: number };
  lHip: { x: number; y: number };
  rHip: { x: number; y: number };
  /** Attachment disc radius at the neck joint — must cover head/neck seam. */
  neckCouplerR: number;
};

export const MOUTH_STATES = [
  'MOUTH_NEUTRAL',
  'MOUTH_SMALL_OPEN',
  'MOUTH_MEDIUM_OPEN',
  'MOUTH_SMILE',
] as const;

export type MouthSlotId = (typeof MOUTH_STATES)[number];
