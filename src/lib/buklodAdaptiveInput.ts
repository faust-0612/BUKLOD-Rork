/**
 * Keep system accessibility font scaling authoritative. This helper adjusts
 * only editable containers, never multiplies the font size itself (RN does it).
 * Android TextInput may scroll internally when the keyboard limits viewport.
 */
export function buklodComposerHeightLimits(
  fontScale: number,
  viewportHeight: number,
  kind: 'comment' | 'message',
): { minHeight: number; maxHeight: number } {
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const windowHeight = Number.isFinite(viewportHeight)
    ? Math.max(400, viewportHeight) : 640;
  const baseMax = kind === 'comment' ? 150 : 110;
  const baseMin = kind === 'comment' ? 48 : 42;
  const cap = Math.max(baseMax, Math.min(360, Math.floor(windowHeight * 0.36)));
  const requested = Math.floor(baseMax * scale);
  const maxHeight = Math.max(baseMax, Math.min(cap, requested));
  const minHeight = Math.min(maxHeight, Math.max(baseMin, Math.round(30 * scale)));
  return { minHeight, maxHeight };
}
