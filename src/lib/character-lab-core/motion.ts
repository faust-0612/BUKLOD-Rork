import type { ReactionId } from './types';

/**
 * Every timing in the Character Lab, in one place. Both renderers read these
 * numbers so the web mirror and the Expo build move identically.
 */
export const MOTION = {
  /** Hero entrance. Total stays under 900ms; UI is tappable from frame 1. */
  entrance: {
    stageFadeMs: 420,
    stageZoomFrom: 1.06,
    characterDelayMs: 140,
    characterMs: 520,
    characterRiseFromPx: 26,
    characterScaleFrom: 0.94,
    lightSweepDelayMs: 220,
    lightSweepMs: 520,
    hudDelayMs: 260,
    hudMs: 240,
    railDelayMs: 320,
    railMs: 260,
    totalMs: 900,
  },
  /** Idle life. Low amplitude, irregular, never a dance. */
  idle: {
    breathLoopMs: 3400,
    breathScale: 1.012,
    breathLiftPx: 4,
    swayLoopMs: 5200,
    swayDeg: 0.8,
    headLoopMs: 4300,
    headDeg: 1.4,
    blinkMinGapMs: 2600,
    blinkMaxGapMs: 6200,
    blinkCloseMs: 90,
    blinkOpenMs: 110,
    doubleBlinkChance: 0.22,
  },
  /** Item swapping. Preview updates immediately, then settles. */
  swap: {
    crossFadeMs: 180,
    layerSettleMs: 220,
    shineSweepMs: 320,
    thumbPressMs: 90,
  },
  /** Claim / reward feedback. */
  claim: {
    pressScale: 0.965,
    pressInMs: 60,
    releaseMs: 140,
    burstDelayMs: 90,
    tokenFlightMs: 500,
    countUpMs: 520,
    chipHoldMs: 900,
    glowBreathMs: 1900,
    glowScaleTo: 1.025,
  },
  /** Threshold celebration. */
  unlock: {
    totalMs: 1250,
    bannerInMs: 260,
    bannerHoldMs: 620,
    bannerOutMs: 240,
    itemRevealDelayMs: 260,
    itemRevealMs: 360,
    stageFlashMs: 420,
  },
  easing: {
    /** Entrances and reveals. */
    out: 'cubic-bezier(0.22, 1, 0.36, 1)',
    /** Glow breath, colour transitions. */
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Particle outward burst. */
    burst: 'cubic-bezier(0.16, 0.84, 0.44, 1)',
  },
} as const;

export interface ReactionSpec {
  readonly id: ReactionId;
  readonly label: string;
  /** Total length of the pose change before returning to idle. */
  readonly durationMs: number;
  /** Particle count for this reaction. 0 = no particles. */
  readonly particles: number;
  /** Vertical hop in px at the peak. */
  readonly hopPx: number;
  /** Extra scale at the peak. */
  readonly scaleTo: number;
  /** Body lean in degrees at the peak. */
  readonly leanDeg: number;
  /** Stage light response, 0..1. */
  readonly stageFlash: number;
}

/**
 * Reusable reactions. CLAIM uses `celebrate`, a new item uses `new_item`, and a
 * threshold crossing uses `milestone`.
 */
export const REACTIONS: Record<ReactionId, ReactionSpec> = {
  neutral: {
    id: 'neutral',
    label: 'Neutral',
    durationMs: 0,
    particles: 0,
    hopPx: 0,
    scaleTo: 1,
    leanDeg: 0,
    stageFlash: 0,
  },
  happy: {
    id: 'happy',
    label: 'Happy',
    durationMs: 620,
    particles: 8,
    hopPx: 10,
    scaleTo: 1.02,
    leanDeg: -1.2,
    stageFlash: 0.12,
  },
  proud: {
    id: 'proud',
    label: 'Proud',
    durationMs: 760,
    particles: 10,
    hopPx: 4,
    scaleTo: 1.035,
    leanDeg: 0.8,
    stageFlash: 0.18,
  },
  thankful: {
    id: 'thankful',
    label: 'Thankful',
    durationMs: 720,
    particles: 8,
    hopPx: 0,
    scaleTo: 0.99,
    leanDeg: 2.2,
    stageFlash: 0.1,
  },
  welcome: {
    id: 'welcome',
    label: 'Welcome',
    durationMs: 680,
    particles: 9,
    hopPx: 6,
    scaleTo: 1.015,
    leanDeg: -2,
    stageFlash: 0.14,
  },
  celebrate: {
    id: 'celebrate',
    label: 'Celebrate',
    durationMs: 820,
    particles: 12,
    hopPx: 16,
    scaleTo: 1.03,
    leanDeg: -1.5,
    stageFlash: 0.22,
  },
  new_item: {
    id: 'new_item',
    label: 'New Item',
    durationMs: 780,
    particles: 10,
    hopPx: 6,
    scaleTo: 1.025,
    leanDeg: 1.4,
    stageFlash: 0.2,
  },
  milestone: {
    id: 'milestone',
    label: 'Milestone',
    durationMs: 1150,
    particles: 22,
    hopPx: 20,
    scaleTo: 1.05,
    leanDeg: -0.6,
    stageFlash: 0.35,
  },
};
