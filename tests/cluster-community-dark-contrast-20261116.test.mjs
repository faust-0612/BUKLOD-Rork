import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const paletteSource = read('src/lib/buklodTheme.ts');
const scoped = read('src/components/BuklodExclusiveScopeCommunity.tsx');
const caption = read('src/components/BuklodExpandableWallCaption.tsx');
const preview = read('src/components/BuklodCommunityCommentPreview.tsx');
const share = read('src/components/BuklodPostInternalShare.tsx');

function luminance(hex) {
  const channels = [1, 3, 5]
    .map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(first, second) {
  const values = [luminance(first), luminance(second)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

const palettes = [
  'cloudWhite', 'softMint', 'sage', 'sky', 'lavenderMist', 'sandCream',
  'nightPine', 'graphite', 'lightMint', 'warmSoft', 'softRose', 'midnight',
];

test('all 12 palettes have readable post names, metadata and link fallback text', () => {
  assert.match(paletteSource, /export function readableAccentOnSurface\(/);
  assert.match(paletteSource, /contrast >= 4\.5 \? theme\.accent : theme\.textPrimary/);
  for (const palette of palettes) {
    const section = paletteSource.match(new RegExp('  ' + palette + ': \\{([\\s\\S]*?)\\n  \\},'))?.[1];
    assert.ok(section, 'Missing palette ' + palette);
    const color = role => section.match(new RegExp(role + ": '(#[0-9A-Fa-f]{6})'"))?.[1];
    const surface = color('surface');
    const primary = color('textPrimary');
    const muted = color('textMuted');
    const accent = color('accent');
    assert.ok(contrast(primary, surface) >= 4.5, palette + ' primary post text');
    assert.ok(contrast(muted, surface) >= 4.5, palette + ' metadata');
    const readableAccent = contrast(accent, surface) >= 4.5 ? accent : primary;
    assert.ok(contrast(readableAccent, surface) >= 4.5, palette + ' mentions/actions');
  }
});

test('scoped community post uses active theme on the visible post card', () => {
  assert.match(scoped, /styles\.author, \{ color: theme\.textPrimary \}/);
  assert.match(scoped, /styles\.meta, \{ color: theme\.textMuted \}/);
  assert.match(scoped, /styles\.body, \{ color: theme\.textPrimary \}/);
  assert.match(scoped, /styles\.summaryText, \{ color: theme\.textMuted \}/);
  assert.match(scoped, /styles\.summaryRow, \{ borderBottomColor: theme\.border \}/);
});
test('captions, comment media previews and share controls use accessible theme accents', () => {
  for (const [name, source] of [['caption', caption], ['comment preview', preview], ['share', share]]) {
    assert.match(source, /readableAccentOnSurface\(theme\)/, name);
  }
  assert.match(caption, /mentionStyle=\{mentionStyle\}/);
  assert.match(caption, /color: accentTextColor/);
  assert.match(preview, /color: accentTextColor/);
  assert.match(share, /social && \{ color: accentTextColor \}/);
});
