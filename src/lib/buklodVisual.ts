/** Shared presentation metrics. Never constrain scaled text to fixed heights. */
export const buklodVisual = {
  space: { screen: 12, section: 12, card: 12, inline: 8, tight: 4 },
  radius: { card: 18, control: 12, sheet: 24, pill: 999 },
  size: { touch: 48, row: 56, icon: 40, avatar: 72, storyWidth: 132, storyHeight: 178 },
  type: { title: 22, section: 16, body: 15, label: 13, caption: 12 },
} as const;

/** Columns respond to available space AND OS font scaling, without shrinking text. */
export function buklodVisualColumns(width: number, fontScale: number): 1 | 2 | 3 {
  const usable = Math.max(0, width - buklodVisual.space.screen * 2);
  const minimum = 156 * Math.max(1, Number.isFinite(fontScale) ? fontScale : 1);
  return usable >= minimum * 3 + 16 ? 3 : usable >= minimum * 2 + 8 ? 2 : 1;
}
