/**
 * Decorative Kingdom world traffic, anchored to the approved 13-station map.
 * These bezier control points mirror existing JOURNEY_PATH geometry exactly.
 * No unlocked stations, rewards, points, purchases, network or new assets.
 */
export type KingdomWorldPoint = readonly [number, number];
export type KingdomWorldPatrol = {
  id: string;
  points: readonly [KingdomWorldPoint, KingdomWorldPoint, KingdomWorldPoint, KingdomWorldPoint];
  offset: number;
  minStage: number;
  color: string;
};
export type KingdomWorldWorker = {
  id: string;
  x: number;
  y: number;
  offset: number;
  minStage: number;
  color: string;
};

/** Fixed, bounded ambient actors: 11 road travelers and 6 town workers maximum. */
export const KINGDOM_WORLD_PATROLS: readonly KingdomWorldPatrol[] = [
  { id: 'farm-trader', points: [[110, 660], [155, 700], [210, 730], [265, 745]], offset: .11, minStage: 1, color: '#f9d996' },
  { id: 'forest-guide', points: [[170, 475], [230, 430], [290, 390], [355, 375]], offset: .31, minStage: 1, color: '#d2ffd0' },
  { id: 'garden-courier', points: [[355, 375], [410, 420], [465, 490], [505, 545]], offset: .63, minStage: 1, color: '#fbd3ec' },
  { id: 'artisan-route', points: [[505, 545], [525, 440], [555, 350], [580, 285]], offset: .82, minStage: 1, color: '#ffe7a9' },
  { id: 'council-envoy', points: [[580, 285], [630, 330], [680, 390], [720, 430]], offset: .24, minStage: 1, color: '#e3f7ff' },
  { id: 'city-dispatch', points: [[720, 430], [765, 355], [795, 305], [825, 260]], offset: .46, minStage: 1, color: '#a6e5ef' },
  { id: 'music-delivery', points: [[825, 260], [885, 285], [930, 315], [970, 350]], offset: .54, minStage: 2, color: '#ffd8f5' },
  { id: 'treasury-caravan', points: [[970, 350], [955, 455], [935, 545], [910, 620]], offset: .78, minStage: 2, color: '#ffe39f' },
  { id: 'mission-supplies', points: [[910, 620], [830, 660], [760, 690], [690, 710]], offset: .17, minStage: 2, color: '#f7e5b3' },
  { id: 'highland-builder', points: [[690, 710], [820, 760], [930, 750], [1040, 710]], offset: .72, minStage: 3, color: '#bff1d0' },
  { id: 'discovery-trail', points: [[970, 350], [1010, 285], [1035, 205], [1045, 135]], offset: .89, minStage: 3, color: '#d5e9ff' },
];

export const KINGDOM_WORLD_WORKERS: readonly KingdomWorldWorker[] = [
  { id: 'farmer', x: 308, y: 716, offset: .10, minStage: 1, color: '#d6ffa6' },
  { id: 'carpenter', x: 482, y: 578, offset: .39, minStage: 1, color: '#ffce9b' },
  { id: 'artisan', x: 617, y: 345, offset: .67, minStage: 1, color: '#e3edff' },
  { id: 'courier', x: 849, y: 294, offset: .21, minStage: 2, color: '#a4e6ff' },
  { id: 'harvester', x: 713, y: 758, offset: .57, minStage: 2, color: '#f5e3a8' },
  { id: 'builder', x: 1018, y: 767, offset: .85, minStage: 3, color: '#c9ffe5' },
];

/** Deterministic cubic Bezier location. A looping phase keeps the actor on its road.
 * Tagged as a Reanimated worklet; also usable by Node's pure geometry tests. */
export function sampleKingdomPatrol(route: KingdomWorldPatrol, cycle: number): { x: number; y: number } {
  'worklet';
  const t = ((cycle + route.offset) % 1 + 1) % 1;
  const u = 1 - t;
  const [a, b, c, d] = route.points;
  return {
    x: u*u*u*a[0] + 3*u*u*t*b[0] + 3*u*t*t*c[0] + t*t*t*d[0],
    y: u*u*u*a[1] + 3*u*u*t*b[1] + 3*u*t*t*c[1] + t*t*t*d[1],
  };
}
