import {
  getBuklodCardTone,
  getStableBuklodCardTone,
  isBuklodDarkPaletteId,
  type BuklodCardToneName,
} from '@/lib/buklodCardTones';

const tones: BuklodCardToneName[] = ['mint', 'sky', 'lavender', 'amber', 'peach', 'teal'];

function luminance(hex: string) {
  const channels = [1, 3, 5].map(offset => {
    const v = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe('BUKLOD card color variety', () => {
  it('has readable text and action contrast in light and dark variants', () => {
    tones.forEach(tone => {
      [false, true].forEach(dark => {
        const colors = getBuklodCardTone(tone, dark);
        expect(contrast(colors.ink, colors.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast('#FFFFFF', colors.action)).toBeGreaterThanOrEqual(4.5);
      });
    });
  });

  it('assigns a stable tone for a cluster even when lists reorder', () => {
    const scopeId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const selected = getStableBuklodCardTone(scopeId);
    expect(tones).toContain(selected);
    expect(getStableBuklodCardTone(scopeId)).toBe(selected);
    expect(getStableBuklodCardTone(scopeId)).toBe(selected);
  });

  it('preserves muted variants for dark global themes', () => {
    expect(isBuklodDarkPaletteId('nightPine')).toBe(true);
    expect(isBuklodDarkPaletteId('graphite')).toBe(true);
    expect(isBuklodDarkPaletteId('lightMint')).toBe(false);
  });
});
