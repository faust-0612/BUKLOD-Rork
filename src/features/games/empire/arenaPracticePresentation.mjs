/**
 * Shared pure Arena viewport math. No Expo, account, network or reward imports.
 * World coordinates stay authoritative in the canonical Arena V2 simulation.
 */
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Frame camera near player while never clipping outside finite battlefield. */
export function arenaCamera(worldWidth, worldHeight, focus, screenWidth, screenHeight, span = 84) {
  const w = Math.max(1, Number(worldWidth) || 1);
  const h = Math.max(1, Number(worldHeight) || 1);
  const aspect = clamp((Number(screenWidth) || 16) / Math.max(1, Number(screenHeight) || 9), 0.55, 3.4);
  // Preserve aspect; fit a bounded region rather than distorting actors.
  let width = clamp(Number(span) || 84, 20, w);
  let height = width / aspect;
  if (height > h) {
    height = h;
    width = Math.min(w, h * aspect);
  }
  // Explicit world-edge zero is a valid camera target (e.g. minimap left/top).
  // Do not treat it as a falsey/missing coordinate and jump to map center.
  const focusX = Number(focus?.x);
  const focusY = Number(focus?.y);
  const x = clamp((Number.isFinite(focusX) ? focusX : w / 2) - width / 2, 0, Math.max(0, w - width));
  const y = clamp((Number.isFinite(focusY) ? focusY : h / 2) - height / 2, 0, Math.max(0, h - height));
  return { x, y, width, height };
}

/** Touch coordinates in a scaled, panned SVG viewport; handy for taps on ground. */
export function arenaScreenToWorld(x, y, screenWidth, screenHeight, camera) {
  const sx = clamp(Number(x) || 0, 0, screenWidth);
  const sy = clamp(Number(y) || 0, 0, screenHeight);
  return { x: camera.x + (sx / Math.max(1, screenWidth)) * camera.width,
    y: camera.y + (sy / Math.max(1, screenHeight)) * camera.height };
}

/** Light, strictly visual-only effects. Authoritative hit/skill outcomes are in Arena engine. */
export function arenaVisualEffects(events, elapsed, ttl = 1100) {
  if (!Array.isArray(events)) return [];
  const valid = new Set(['skill', 'dash', 'defeat', 'tower_destroyed', 'seal_breached', 'buff', 'level_up', 'equipment_drop', 'unit_spawn']);
  return events.filter(e => e && valid.has(e.type) && Number.isFinite(e.time) &&
    e.time <= elapsed && elapsed - e.time < ttl)
    .slice(-14)
    .map(e => ({ ...e, strength: clamp(1 - (elapsed - e.time) / ttl, 0, 1) }));
}

/** Non-authoritative assistance for contextual controls, no balance modifications. */
export function arenaNearby(state, player) {
  if (!state || !player) return { mine: null, loot: null, tower: null, canSiege: false, canBuild: false, canBank: false };
  const distance = p => Math.hypot(player.x - p.x, player.y - p.y);
  const closest = (items, reach) => (items || []).filter(x => x && x.alive !== false && distance(x) <= reach)
    .sort((a, b) => distance(a) - distance(b))[0] ?? null;
  const mine = closest((state.nodes || []).filter(n => n.stock > 0), 8);
  const loot = closest((state.loot || []).filter(n => !n.expires || n.expires > state.elapsed), 3);
  const tower = closest((state.towers || []).filter(t => t.team === player.team && t.hp > 0), 10);
  const enemy = player.team === 'A' ? 'B' : 'A';
  const seal = { x: enemy === 'A' ? 14 : state.w - 14, y: state.h / 2 };
  const canSiege = distance(seal) <= 7 && (state.towers || []).filter(t => t.team === enemy && t.hp > 0).length <= 1 && !state.seals?.[enemy]?.breached;
  const base = { x: player.team === 'A' ? 18 : state.w - 18, y: state.h / 2 };
  return { mine, loot, tower, canSiege, canBuild: distance(base) <= 48,
    canBank: distance(base) <= 13 };
}
