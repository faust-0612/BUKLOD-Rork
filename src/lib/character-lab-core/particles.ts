/**
 * Deterministic particle specs. The renderer only interpolates — all randomness
 * is resolved here so web and Expo can share the exact same burst geometry and
 * so a burst can be replayed identically.
 *
 * Particles genuinely travel: each spec carries an outward distance, a drift,
 * and a rotation, not just an opacity fade.
 */

export type ParticleTone = 'gold' | 'star' | 'mint' | 'teal';

export interface ParticleSpec {
  readonly id: number;
  /** Launch angle in degrees, 0 = straight up, positive = clockwise. */
  readonly angleDeg: number;
  /** Travel distance in px. */
  readonly distance: number;
  /** Sideways drift applied over the flight, in px. */
  readonly drift: number;
  /** Extra upward lift so particles rise as they fade. */
  readonly lift: number;
  readonly delayMs: number;
  readonly durationMs: number;
  readonly size: number;
  readonly spinDeg: number;
  readonly tone: ParticleTone;
  /** True for the few particles that leave a short spark trail. */
  readonly trail: boolean;
}

/** mulberry32 — tiny deterministic PRNG so bursts are reproducible. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TONES: readonly ParticleTone[] = ['gold', 'star', 'mint', 'teal'];

export interface BurstOptions {
  /** 8–12 for ordinary events, 18–24 for a major milestone. */
  readonly count: number;
  readonly seed?: number;
  /** Base travel distance in px, scaled per particle. */
  readonly spread?: number;
  /** Bias the burst upward (0 = full circle, 1 = only upward). */
  readonly upwardBias?: number;
  readonly tones?: readonly ParticleTone[];
  readonly sizeRange?: readonly [number, number];
  readonly durationRange?: readonly [number, number];
}

export function makeBurst(options: BurstOptions): ParticleSpec[] {
  const {
    count,
    seed = 1,
    spread = 120,
    upwardBias = 0.55,
    tones = TONES,
    sizeRange = [6, 14],
    durationRange = [420, 640],
  } = options;
  const random = rng(seed * 2654435761);
  const specs: ParticleSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    // Even angular distribution with jitter, then pulled toward straight up.
    const even = (i / count) * 360 - 180;
    const jitter = (random() - 0.5) * (360 / count) * 0.9;
    const raw = even + jitter;
    const angleDeg = raw * (1 - upwardBias * 0.6);
    const distance = spread * (0.55 + random() * 0.75);
    specs.push({
      id: i,
      angleDeg,
      distance,
      drift: (random() - 0.5) * 34,
      lift: 18 + random() * 42,
      delayMs: Math.round(random() * 120),
      durationMs: Math.round(
        durationRange[0] + random() * (durationRange[1] - durationRange[0]),
      ),
      size: Math.round(sizeRange[0] + random() * (sizeRange[1] - sizeRange[0])),
      spinDeg: Math.round((random() - 0.5) * 320),
      tone: tones[Math.floor(random() * tones.length)] ?? 'gold',
      trail: random() > 0.55,
    });
  }
  return specs;
}

export interface OrbitSpec {
  readonly id: number;
  readonly radius: number;
  readonly startDeg: number;
  readonly durationMs: number;
  readonly size: number;
  readonly tone: ParticleTone;
  readonly wobble: number;
}

/** Slow orbiting stars used by the Ascendant Halo special effect. */
export function makeOrbit(count: number, seed = 7): OrbitSpec[] {
  const random = rng(seed * 40503);
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    radius: 74 + random() * 46,
    startDeg: (i / count) * 360,
    durationMs: Math.round(6200 + random() * 3200),
    size: Math.round(7 + random() * 7),
    tone: (random() > 0.5 ? 'gold' : 'star') as ParticleTone,
    wobble: 6 + random() * 12,
  }));
}

export interface MoteSpec {
  readonly id: number;
  readonly x: number;
  readonly durationMs: number;
  readonly delayMs: number;
  readonly size: number;
  readonly drift: number;
  readonly tone: ParticleTone;
}

/** Ambient rising motes for the stage atmosphere and the Verdant Aura. */
export function makeMotes(count: number, seed = 3): MoteSpec[] {
  const random = rng(seed * 668265263);
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: random() * 100,
    durationMs: Math.round(5200 + random() * 5200),
    delayMs: Math.round(random() * 5200),
    size: Math.round(3 + random() * 6),
    drift: (random() - 0.5) * 60,
    tone: (random() > 0.65 ? 'gold' : random() > 0.35 ? 'mint' : 'teal') as ParticleTone,
  }));
}
