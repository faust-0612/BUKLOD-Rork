import {
  RIG_VIEWBOX,
  type Skeleton,
} from '@/lib/character-rig/contract';

/**
 * Youthful adult male — ~7.3 heads.
 * Hip is the skeleton root. All other joints are parent-local.
 */
export const MALE_SKELETON: Skeleton = {
  viewBox: RIG_VIEWBOX,
  headUnit: 76,
  bones: {
    head: 76,
    neck: 22,
    upperArm: 70,
    forearm: 58,
    hand: 22,
    thigh: 152,
    shin: 88,
    foot: 30,
  },
  root: { x: 130, y: 344 },
  torso: { x: 0, y: 0 },
  head: { x: 0, y: -226 },
  lShoulder: { x: -44, y: -200 },
  rShoulder: { x: 44, y: -200 },
  lHip: { x: -18, y: 10 },
  rHip: { x: 18, y: 10 },
  neckCouplerR: 13,
};

/** Degrees. Limbs drawn along +Y from their pivot. 0 = hanging down. */
export const REST_JOINTS = {
  rootY: 0,
  rootRot: 0,
  torsoRot: 0,
  headRot: 0,
  lShoulder: -6,
  lElbow: -10,
  lHand: 0,
  rShoulder: 6,
  rElbow: 10,
  rHand: 0,
  lHip: -2,
  lKnee: 4,
  lFoot: -82,
  rHip: 2,
  rKnee: -4,
  rFoot: 82,
} as const;

export const WAVE_MS = 1100;
export const WAVE_SLOW_MS = 2000;
export const NOD_MS = 1400;
export const NOD_SLOW_MS = 2000;
export const POINT_MS = 1400;
export const POINT_SLOW_MS = 2000;
export const CELEBRATE_MS = 1420;
