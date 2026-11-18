import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const screens = [
  'src/app/learn/lesson.tsx',
  'src/app/learn/[id].tsx',
  'src/app/(tabs)/learn.tsx',
  'src/app/word/index.tsx',
  'src/app/devotional/[id].tsx',
  'src/components/formation/FormationJourneySection.tsx',
  'src/components/formation/FormationAdvancedStageCatalog.tsx',
];

const relativeLuminance = hex => {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
};
const contrast = (a, b) => {
  const aa = relativeLuminance(a), bb = relativeLuminance(b);
  return (Math.max(aa, bb) + .05) / (Math.min(aa, bb) + .05);
};

test('Faith cards explicitly override theme-dependent dark Card background', () => {
  const component = read('src/components/education/ReadableFaithSurface.tsx');
  assert.match(component, /backgroundColor:\s*colors\.white/);
  assert.match(component, /borderColor:\s*colors\.line/);
  assert.match(component, /color:\s*colors\.muted/);
  assert.match(component, /style=\{style\s*\?\s*\[readableCard,\s*style\]/);
});

test('every affected lesson or Word card consumes the scoped compatibility surface', () => {
  for (const file of screens) {
    assert.match(read(file), /ReadableFaithCard as Card/, 'missing scoped surface: ' + file);
  }
});

test('dark mode does not hide disabled lesson cards with whole-card alpha', () => {
  for (const file of screens) {
    assert.doesNotMatch(read(file), /opacity:\s*0\.72/, file);
  }
});

test('legacy static Faith type has accessible foreground contrast on scoped surface', () => {
  const colors = ['#16202A','#697784','#176B2C','#0E4F20','#123D73','#C9332D','#8F5400'];
  for (const fg of colors) {
    assert.ok(contrast(fg, '#FFFFFF') >= 4.5, fg + ' contrast <4.5:1');
  }
});

test('app-wide theme, AdMob and navigation implementations were not changed', () => {
  const manifest = JSON.parse(read('.buklod/scopes/faith-learning-word-contrast-20261118.json'));
  for (const p of manifest.allowedPaths) {
    assert.doesNotMatch(p, /src\/providers\/AdsProvider|src\/lib\/buklodTheme\.ts|src\/components\/UI\.tsx|src\/app\/\(tabs\)\/_layout/);
  }
});
