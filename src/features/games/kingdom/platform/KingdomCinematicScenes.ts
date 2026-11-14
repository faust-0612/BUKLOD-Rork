/**
 * Canonical 39-scene visual choreography catalog, isolated from rewards.
 * Each entry has a distinct deterministic seed and an intentional genre-
 * appropriate glyph/geometry/motion, not a random generic animation.
 * Auth, level, character unlock and Mastery points remain server-owned.
 */
export type KingdomSceneShape =
  | 'pillars' | 'lanes' | 'tiles' | 'rings' | 'rays'
  | 'circuit' | 'runes' | 'equalizer' | 'labyrinth';
export type KingdomSceneMotion =
  | 'rise' | 'flow' | 'orbit' | 'scan' | 'pulse' | 'trace' | 'sweep' | 'wave';
export type KingdomSceneProfile = {
  title: string;
  character: string;
  glyph: string;
  shape: KingdomSceneShape;
  motion: KingdomSceneMotion;
  accent: string;
  shade: string;
  seed: number;
  cycleMs: number;
  density: number;
};
/** Thirteen deliberately different motion signatures for approved character art.
 * Sprite-based staging rigs, not fabricated Rive .riv files. */
export type KingdomCharacterMotion = {
  action: string;
  idleX: number;
  idleY: number;
  collectHop: number;
  impactShake: number;
  victoryScale: number;
  turnDeg: number;
  moveX: number;
};
export const KINGDOM_CHARACTER_MOTION: Readonly<Record<string, KingdomCharacterMotion>> = {
  phan: { action: 'workshop', idleX: 1.1, idleY: 1.9, collectHop: 8, impactShake: 4.5, victoryScale: .08, turnDeg: 2, moveX: 6 },
  quin: { action: 'discovery', idleX: 2.1, idleY: 2.6, collectHop: 12, impactShake: 6, victoryScale: .11, turnDeg: 4, moveX: 9 },
  van: { action: 'dispatch', idleX: 1.4, idleY: 2.0, collectHop: 9, impactShake: 5.8, victoryScale: .10, turnDeg: 3, moveX: 8 },
  christian: { action: 'council', idleX: 1.2, idleY: 1.7, collectHop: 7, impactShake: 4.2, victoryScale: .12, turnDeg: 2, moveX: 5 },
  lhen: { action: 'rhythm', idleX: 2.8, idleY: 3.8, collectHop: 13, impactShake: 6.4, victoryScale: .15, turnDeg: 7, moveX: 10 },
  jawo: { action: 'dodge', idleX: 2.3, idleY: 3.1, collectHop: 16, impactShake: 8.0, victoryScale: .13, turnDeg: 6, moveX: 14 },
  trudice: { action: 'wonder', idleX: 2.7, idleY: 3.6, collectHop: 18, impactShake: 5.2, victoryScale: .17, turnDeg: 9, moveX: 12 },
  ace: { action: 'rescue', idleX: 1.8, idleY: 2.5, collectHop: 12, impactShake: 7.2, victoryScale: .12, turnDeg: 5, moveX: 11 },
  mitch: { action: 'paint', idleX: 1.7, idleY: 2.9, collectHop: 11, impactShake: 5.0, victoryScale: .14, turnDeg: 8, moveX: 9 },
  niel: { action: 'expedition', idleX: 2.4, idleY: 2.7, collectHop: 14, impactShake: 6.8, victoryScale: .12, turnDeg: 5, moveX: 13 },
  angel: { action: 'treasury', idleX: 1.0, idleY: 2.1, collectHop: 10, impactShake: 4.0, victoryScale: .16, turnDeg: 3, moveX: 7 },
  vhen: { action: 'harvest', idleX: 1.9, idleY: 3.0, collectHop: 13, impactShake: 5.4, victoryScale: .13, turnDeg: 6, moveX: 10 },
  ellusur: { action: 'build', idleX: 1.6, idleY: 2.2, collectHop: 9, impactShake: 6.2, victoryScale: .09, turnDeg: 4, moveX: 8 },
};
export const KINGDOM_CINEMATIC_SCENES: Readonly<Record<string, KingdomSceneProfile>> = {
  'phan-enterprise-builder': { title: "Enterprise Builder", character: 'phan', glyph: "🏭", shape: 'pillars', motion: 'rise', accent: '#ffcc70', shade: '#905728', seed: 13, cycleMs: 4700, density: 4 },
  'phan-trade-master': { title: "Trade Master", character: 'phan', glyph: "⚖️", shape: 'lanes', motion: 'flow', accent: '#ffcc70', shade: '#905728', seed: 50, cycleMs: 5130, density: 5 },
  'phan-market-match': { title: "Market Match", character: 'phan', glyph: "🧺", shape: 'tiles', motion: 'orbit', accent: '#ffcc70', shade: '#905728', seed: 87, cycleMs: 5560, density: 6 },
  'quin-discovery-expedition': { title: "Discovery Expedition", character: 'quin', glyph: "🧭", shape: 'rings', motion: 'scan', accent: '#92dbff', shade: '#375998', seed: 124, cycleMs: 5990, density: 4 },
  'quin-guessing-quest': { title: "Guessing Quest", character: 'quin', glyph: "🔎", shape: 'rays', motion: 'pulse', accent: '#92dbff', shade: '#375998', seed: 161, cycleMs: 6420, density: 5 },
  'quin-code-breaker': { title: "Code Breaker", character: 'quin', glyph: "🔐", shape: 'circuit', motion: 'trace', accent: '#92dbff', shade: '#375998', seed: 198, cycleMs: 6850, density: 6 },
  'van-living-city-dispatch': { title: "City Dispatch", character: 'van', glyph: "🚦", shape: 'lanes', motion: 'sweep', accent: '#80f4dd', shade: '#245a74', seed: 235, cycleMs: 7280, density: 4 },
  'van-sudoku-master': { title: "Sudoku Master", character: 'van', glyph: "🔢", shape: 'tiles', motion: 'scan', accent: '#80f4dd', shade: '#245a74', seed: 272, cycleMs: 4700, density: 5 },
  'van-mind-challenge': { title: "Mind Challenge", character: 'van', glyph: "🧩", shape: 'circuit', motion: 'pulse', accent: '#80f4dd', shade: '#245a74', seed: 309, cycleMs: 5130, density: 6 },
  'christian-civic-leadership': { title: "Leadership Council", character: 'christian', glyph: "🏛️", shape: 'pillars', motion: 'rise', accent: '#ffe6a2', shade: '#7659a8', seed: 346, cycleMs: 5560, density: 4 },
  'christian-bible-crown': { title: "Bible Crown", character: 'christian', glyph: "👑", shape: 'rays', motion: 'orbit', accent: '#ffe6a2', shade: '#7659a8', seed: 383, cycleMs: 5990, density: 5 },
  'christian-scripture-word-search': { title: "Scripture Word Search", character: 'christian', glyph: "📜", shape: 'runes', motion: 'trace', accent: '#ffe6a2', shade: '#7659a8', seed: 420, cycleMs: 6420, density: 6 },
  'lhen-rhythm-journey': { title: "Rhythm Journey", character: 'lhen', glyph: "🎼", shape: 'equalizer', motion: 'wave', accent: '#ffb1de', shade: '#854496', seed: 457, cycleMs: 6850, density: 4 },
  'lhen-melody-memory': { title: "Melody Memory", character: 'lhen', glyph: "🎵", shape: 'rings', motion: 'pulse', accent: '#ffb1de', shade: '#854496', seed: 494, cycleMs: 7280, density: 5 },
  'lhen-beat-composer': { title: "Beat Composer", character: 'lhen', glyph: "🥁", shape: 'equalizer', motion: 'sweep', accent: '#ffb1de', shade: '#854496', seed: 531, cycleMs: 4700, density: 6 },
  'jawo-forest-trail': { title: "Forest Trail", character: 'jawo', glyph: "🌲", shape: 'rays', motion: 'flow', accent: '#b3fb9d', shade: '#266348', seed: 568, cycleMs: 5130, density: 4 },
  'jawo-trail-maze': { title: "Trail Maze", character: 'jawo', glyph: "🗺️", shape: 'labyrinth', motion: 'trace', accent: '#b3fb9d', shade: '#266348', seed: 605, cycleMs: 5560, density: 5 },
  'jawo-nature-match': { title: "Nature Match", character: 'jawo', glyph: "🍃", shape: 'tiles', motion: 'orbit', accent: '#b3fb9d', shade: '#266348', seed: 642, cycleMs: 5990, density: 6 },
  'trudice-playground-memory': { title: "Wonder Path", character: 'trudice', glyph: "🌈", shape: 'rings', motion: 'pulse', accent: '#fac7ff', shade: '#7841ab', seed: 679, cycleMs: 6420, density: 4 },
  'trudice-picture-pairs': { title: "Picture Pairs", character: 'trudice', glyph: "🧸", shape: 'tiles', motion: 'scan', accent: '#fac7ff', shade: '#7841ab', seed: 716, cycleMs: 6850, density: 5 },
  'trudice-word-garden': { title: "Word Garden", character: 'trudice', glyph: "🌸", shape: 'runes', motion: 'rise', accent: '#fac7ff', shade: '#7841ab', seed: 753, cycleMs: 7280, density: 6 },
  'ace-rescue-grid': { title: "Rescue Grid", character: 'ace', glyph: "🚑", shape: 'circuit', motion: 'sweep', accent: '#d1e8ff', shade: '#3c577c', seed: 790, cycleMs: 4700, density: 4 },
  'ace-chess-master': { title: "Chess Master", character: 'ace', glyph: "♟", shape: 'tiles', motion: 'trace', accent: '#d1e8ff', shade: '#3c577c', seed: 827, cycleMs: 5130, density: 5 },
  'ace-tower-tactics': { title: "Tower Tactics", character: 'ace', glyph: "🏰", shape: 'pillars', motion: 'rise', accent: '#d1e8ff', shade: '#3c577c', seed: 864, cycleMs: 5560, density: 6 },
  'mitch-restore-mural': { title: "Restore the Mural", character: 'mitch', glyph: "🎨", shape: 'rays', motion: 'sweep', accent: '#ffb6a4', shade: '#88485c', seed: 901, cycleMs: 5990, density: 4 },
  'mitch-block-forge': { title: "Block Forge", character: 'mitch', glyph: "🧱", shape: 'tiles', motion: 'rise', accent: '#ffb6a4', shade: '#88485c', seed: 938, cycleMs: 6420, density: 5 },
  'mitch-color-merge': { title: "Color Merge", character: 'mitch', glyph: "💠", shape: 'rings', motion: 'orbit', accent: '#ffb6a4', shade: '#88485c', seed: 975, cycleMs: 6850, density: 6 },
  'niel-mission-trail': { title: "Mission Trail", character: 'niel', glyph: "⛺", shape: 'lanes', motion: 'flow', accent: '#fadd9b', shade: '#73552b', seed: 1012, cycleMs: 7280, density: 4 },
  'niel-expedition-puzzle': { title: "Expedition Puzzle", character: 'niel', glyph: "⛰️", shape: 'labyrinth', motion: 'scan', accent: '#fadd9b', shade: '#73552b', seed: 1049, cycleMs: 4700, density: 5 },
  'niel-word-explorer': { title: "Word Explorer", character: 'niel', glyph: "🗝️", shape: 'runes', motion: 'trace', accent: '#fadd9b', shade: '#73552b', seed: 1086, cycleMs: 5130, density: 6 },
  'angel-kingdom-treasury': { title: "Kingdom Treasury", character: 'angel', glyph: "💎", shape: 'pillars', motion: 'pulse', accent: '#ffe8a2', shade: '#996e2f', seed: 1123, cycleMs: 5560, density: 4 },
  'angel-number-vault': { title: "Number Vault", character: 'angel', glyph: "🔢", shape: 'circuit', motion: 'scan', accent: '#ffe8a2', shade: '#996e2f', seed: 1160, cycleMs: 5990, density: 5 },
  'angel-treasure-merge': { title: "Treasure Merge", character: 'angel', glyph: "🪙", shape: 'rings', motion: 'orbit', accent: '#ffe8a2', shade: '#996e2f', seed: 1197, cycleMs: 6420, density: 6 },
  'vhen-farm-to-market': { title: "Farm to Market", character: 'vhen', glyph: "🌾", shape: 'lanes', motion: 'flow', accent: '#dcf39b', shade: '#54713a', seed: 1234, cycleMs: 6850, density: 4 },
  'vhen-harvest-match': { title: "Harvest Match", character: 'vhen', glyph: "🍇", shape: 'tiles', motion: 'sweep', accent: '#dcf39b', shade: '#54713a', seed: 1271, cycleMs: 7280, density: 5 },
  'vhen-farm-merge': { title: "Farm Merge", character: 'vhen', glyph: "🌱", shape: 'rings', motion: 'rise', accent: '#dcf39b', shade: '#54713a', seed: 1308, cycleMs: 4700, density: 6 },
  'elesur-village-builder': { title: "Village Builder", character: 'ellusur', glyph: "🏘️", shape: 'pillars', motion: 'rise', accent: '#b7f0cc', shade: '#367365', seed: 1345, cycleMs: 5130, density: 4 },
  'elesur-domino-village': { title: "Domino Village", character: 'ellusur', glyph: "🁫", shape: 'tiles', motion: 'flow', accent: '#b7f0cc', shade: '#367365', seed: 1382, cycleMs: 5560, density: 5 },
  'elesur-bridge-puzzle': { title: "Bridge Puzzle", character: 'ellusur', glyph: "🌉", shape: 'circuit', motion: 'trace', accent: '#b7f0cc', shade: '#367365', seed: 1419, cycleMs: 5990, density: 6 },
};
export function getKingdomCinematicScene(gameId: string): KingdomSceneProfile | null {
  return KINGDOM_CINEMATIC_SCENES[gameId] ?? null;
}
