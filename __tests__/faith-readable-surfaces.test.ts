import { readFileSync } from 'fs';
import { resolve } from 'path';

import { colors } from '../src/lib/theme';

const faithScreens = [
  'src/app/learn/lesson.tsx',
  'src/app/learn/[id].tsx',
  'src/app/(tabs)/learn.tsx',
  'src/app/word/index.tsx',
  'src/app/devotional/[id].tsx',
  'src/components/formation/FormationJourneySection.tsx',
  'src/components/formation/FormationAdvancedStageCatalog.tsx',
];

function luminance(hex: string) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('Faith readable surfaces regression', () => {
  test.each(faithScreens)('%s keeps legacy text on a contrast-safe card', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    expect(source).toContain('ReadableFaithCard as Card');
  });

  test('the legacy Faith foreground palette meets 4.5:1 on white', () => {
    for (const foreground of [
      colors.text,
      colors.muted,
      colors.green,
      colors.greenDark,
      colors.blue,
      colors.danger,
      '#8F5400',
    ]) {
      expect(contrast(foreground, colors.white)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('light card and readable heading cannot inherit a dark system surface', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/education/ReadableFaithSurface.tsx'),
      'utf8',
    );
    expect(source).toContain('backgroundColor: colors.white');
    expect(source).toContain('borderColor: colors.line');
    expect(source).toContain('color: colors.muted');
  });

  test('locked learning cards do not fade all text with opacity', () => {
    const paths = [
      'src/app/learn/[id].tsx',
      'src/components/formation/FormationJourneySection.tsx',
      'src/components/formation/FormationAdvancedStageCatalog.tsx',
    ];
    for (const path of paths) {
      const content = readFileSync(resolve(process.cwd(), path), 'utf8');
      expect(content).not.toMatch(/opacity:\s*0\.72/);
    }
  });
});
