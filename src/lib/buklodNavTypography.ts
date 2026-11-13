/**
 * Additional height reserved by the persistent bottom navigation when Android
 * accessibility font settings enlarge labels. Never clamp the system font.
 * Two-line labels remain readable on small devices.
 */
export function getBuklodNavTypographyExtraHeight(fontScale: number): number {
  if (!Number.isFinite(fontScale) || fontScale <= 1) return 0;
  return Math.ceil((fontScale - 1) * 28) + (fontScale >= 1.75 ? 18 : 0);
}
