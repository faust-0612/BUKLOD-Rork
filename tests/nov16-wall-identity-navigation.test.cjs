const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const wall = readFileSync(resolve(__dirname, '../src/app/(tabs)/buklod.tsx'), 'utf8');

test('compact Wall identity does not regress existing navigation, ad rows, or post actions', () => {
  const header = wall.split('BUKLOD_WALL_TWO_COLUMN_HEADER_R3_20261117')[1]?.split('<BuklodPostMotion')[0] ?? '';
  assert.ok(header, 'new Wall header must be present');
  assert.match(header, /BuklodTappablePersonName/);
  assert.match(header, /numberOfLines=\{1\}/);
  assert.match(header, /toggleAuthorFollow/);
  assert.match(header, /onReport=/);
  assert.match(header, /onDelete=/);
  assert.match(wall, /<BuklodFocusVisibleRow/);
  assert.match(wall, /<BuklodCommunityInlineAd/);
  assert.match(wall, /<BuklodPostMotion/);
  assert.match(wall, /<BuklodCommunityPostEngagement/);
});
