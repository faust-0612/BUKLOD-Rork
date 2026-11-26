import { BUKLOD_CIRCLE_RANK_FAMILIES, BUKLOD_CIRCLE_RANK_LEVELS } from '@/lib/buklodCircleRankArt';

/** Approved roadmap, not a grant of server entitlements. Keep proposed rewards labeled until wired and verified. */
const GROUP_REWARDS = [
  [
    "Adaptive text layout",
    "Clean bold typography",
    "Text alignment controls",
    "Decorative comment typography",
    "Personal QR card styling"
  ],
  [
    "Emerald Faith background",
    "Living foliage and light; Connect bubble colors",
    "Sapphire Dawn background; elegant serif typography",
    "Animated profile frame; layered nature ambiance",
    "Garden of Hope; signature cinematic style"
  ],
  [
    "Amethyst Sky background",
    "Flowing mist; Connect reply card styling",
    "Crystal Waters background; story frame",
    "Water reflections; voice waveform skin",
    "Quiet Moon; celestial profile cover"
  ],
  [
    "Golden Light background",
    "Metallic reflections; decorative Connect accents",
    "Bronze Legacy background; framed typography",
    "Architectural ornaments; greeting card styling",
    "Architect’s Dawn; signature post design"
  ],
  [
    "Aurora Blessing background",
    "Living aurora; reaction effect",
    "Ocean of Grace background; pinned message styling",
    "Dynamic waves; achievement showcase",
    "Living Paradise; dimensional profile scene"
  ],
  [
    "Ember Crown background",
    "Living flames; legendary Connect accents",
    "Sunrise Victory background; royal lettering",
    "Dynamic energy; story transition",
    "Crimson Valour; legendary profile entrance"
  ],
  [
    "Royal Nebula background",
    "Planetary orbits; cosmic Connect bubbles",
    "Celestial Throne background; cosmic typography",
    "Galaxy movement; share card styling",
    "Infinity Orbit; cinematic identity"
  ],
  [
    "Genesis of Light background",
    "Radiant energy; celestial Connect accents",
    "Eternal Crown background; divine typography",
    "Cosmic transformations; achievement scene",
    "Divine Cosmos; ultimate cinematic collection"
  ]
] as const;
export const RANK_VISUAL_MILESTONES = GROUP_REWARDS.flatMap((rewards, familyIndex) => rewards.map((description, levelIndex) => ({
  order: familyIndex * 5 + levelIndex + 1,
  rankName: BUKLOD_CIRCLE_RANK_FAMILIES[familyIndex] + ' ' + BUKLOD_CIRCLE_RANK_LEVELS[levelIndex],
  description,
})));
export function rankVisualMilestone(order: unknown) {
  return typeof order === 'number' && Number.isInteger(order) && order >= 1 && order <= 40 ? RANK_VISUAL_MILESTONES[order - 1] : null;
}
export function nextRankVisualMilestone(order: unknown) {
  return rankVisualMilestone(order) ? rankVisualMilestone(Number(order) + 1) : null;
}
/** Regular earned privileges never require an ad. Optional cosmetic-only bonus is a separate grant. */
export const RANK_COLLECTION_AD_POLICY = Object.freeze({
  format: 'rewarded' as const, optIn: true, allowSkip: true, rankActivationRequiresAd: false,
  interruptsCelebration: false, transferable: false, cashValue: false, grantsBP: false, grantsQMP: false,
  requireVerifiedReward: true, idempotentGrant: true,
});
