/**
 * BUKLOD Empire Arena controller layout (cosmetic, local-device only).
 * Coordinates are normalized to the *actual battlefield* dimensions.
 * No wallet, account eligibility or game-authoritative state is kept here.
 */
export const ARENA_HUD_VERSION = 2;
export const ARENA_HUD_DEFAULT = Object.freeze({
  joystick: { x: 0.112, y: 0.73 },
  attack:   { x: 0.912, y: 0.74 },
  primary:  { x: 0.802, y: 0.65 },
  secondary:{ x: 0.835, y: 0.35 },
  ultimate: { x: 0.926, y: 0.32 },
  mine:     { x: 0.505, y: 0.79 },
  bank:     { x: 0.565, y: 0.79 },
  train:    { x: 0.625, y: 0.79 },
  tactics:  { x: 0.685, y: 0.79 },
});
export const ARENA_HUD_KEYS = Object.freeze(Object.keys(ARENA_HUD_DEFAULT));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function arenaHudBounds(size, width, height) {
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);
  const halfX = clamp((Number(size) || 44) / (2 * w), 0, .5);
  const halfY = clamp((Number(size) || 44) / (2 * h), 0, .5);
  return { minX: halfX, maxX: 1 - halfX, minY: halfY, maxY: 1 - halfY };
}
export function clampArenaHudPoint(point, size, width, height) {
  const b = arenaHudBounds(size, width, height);
  return {
    x: clamp(Number.isFinite(point?.x) ? point.x : .5, b.minX, b.maxX),
    y: clamp(Number.isFinite(point?.y) ? point.y : .5, b.minY, b.maxY),
  };
}
export function moveArenaHudPoint(origin, dx, dy, size, width, height) {
  return clampArenaHudPoint({
    x: (origin?.x ?? .5) + dx / Math.max(1, width),
    y: (origin?.y ?? .5) + dy / Math.max(1, height),
  }, size, width, height);
}
export function sanitizeArenaHudLayout(raw) {
  let parsed = raw;
  try { if (typeof parsed === 'string') parsed = JSON.parse(parsed); }
  catch { return { ...ARENA_HUD_DEFAULT }; }
  const saved = parsed?.version === ARENA_HUD_VERSION ? parsed.positions : null;
  const out = {};
  for (const key of ARENA_HUD_KEYS) {
    const p = saved?.[key];
    out[key] = p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
      p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 ?
      { x: p.x, y: p.y } : { ...ARENA_HUD_DEFAULT[key] };
  }
  return out;
}
export function serializeArenaHudLayout(positions) {
  return JSON.stringify({ version: ARENA_HUD_VERSION,
    positions: sanitizeArenaHudLayout({ version: ARENA_HUD_VERSION, positions }) });
}
