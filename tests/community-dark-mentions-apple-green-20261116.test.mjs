import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const renderer = read('src/components/BuklodMentionText.tsx');
const tokens = read('src/lib/buklodMentionCompose.ts');
const caption = read('src/components/BuklodExpandableWallCaption.tsx');
const comments = read('src/components/BuklodCommunityCommentBubble.tsx');
const detail = read('src/app/post/[id].tsx');

function luminance(hex) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('dark palette mentions override default and caller text colors at final render', () => {
  assert.match(renderer, /useBuklodTheme\(\)/);
  assert.match(renderer, /isBuklodDarkPaletteId\(paletteId\)/);
  assert.match(renderer, /style=\{\[mentionStyle \?\? DEFAULT_MENTION_STYLE, darkMentionStyle\]\}/);
  assert.match(renderer, /const DARK_MENTION_STYLE: TextStyle = \{ color: BUKLOD_DARK_MENTION_COLOR \}/);
});

test('light palette keeps established mention styling and parsing', () => {
  assert.match(tokens, /BUKLOD_MENTION_COLOR = '#176B2C'/);
  assert.match(renderer, /: undefined;/);
  assert.match(renderer, /splitMentionParts\(text, knownNames\)/);
  assert.match(caption, /<BuklodMentionText/);
  assert.match(comments, /<BuklodMentionText/);
  assert.match(detail, /<BuklodMentionText/);
});

test('apple green provides at least 4.5:1 contrast on BUKLOD dark surfaces', () => {
  const apple = tokens.match(/BUKLOD_DARK_MENTION_COLOR = '(#[0-9A-Fa-f]{6})'/)?.[1];
  assert.ok(apple);
  for (const surface of ['#1C2621', '#121A16', '#1A3D28', '#1E1E1E', '#181818', '#161B22']) {
    assert.ok(contrast(apple, surface) >= 4.5, surface);
  }
});
