import {
  RIG_ASPECT,
  RIG_VIEWBOX,
} from '@/lib/character-rig/contract';
import {
  CELEBRATE_MS,
  NOD_MS,
  NOD_SLOW_MS,
  POINT_MS,
  POINT_SLOW_MS,
  REST_JOINTS,
  WAVE_MS,
  WAVE_SLOW_MS,
} from '@/lib/character-rig/skeletonMale';

export {
  RIG_ASPECT,
  RIG_VIEWBOX,
  REST_JOINTS,
  WAVE_MS,
  WAVE_SLOW_MS,
  NOD_MS,
  NOD_SLOW_MS,
  POINT_MS,
  POINT_SLOW_MS,
  CELEBRATE_MS,
};

export function heroHeightFraction(
  stageWidth: number,
  compact: boolean
): number {
  if (compact) return 0.54;
  if (stageWidth >= 420) return 0.68;
  if (stageWidth >= 360) return 0.64;
  return 0.58;
}
