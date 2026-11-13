import test from 'node:test';
import assert from 'node:assert/strict';
import { buklodComposerHeightLimits } from '../src/lib/buklodAdaptiveInput.ts';

test('Android font scale enlarges composer container without multiplying font glyph size twice', () => {
  const base = buklodComposerHeightLimits(1, 800, 'comment');
  const large = buklodComposerHeightLimits(2, 800, 'comment');
  assert.deepEqual(base, { minHeight: 48, maxHeight: 150 });
  assert.ok(large.maxHeight > base.maxHeight);
  assert.ok(large.minHeight >= 60);
  assert.ok(large.maxHeight <= Math.floor(800 * 0.36));
});
test('message input scales at 150%, remains usable on narrow viewport, and bounds extreme fonts', () => {
  const normal = buklodComposerHeightLimits(1, 700, 'message');
  const large = buklodComposerHeightLimits(1.5, 700, 'message');
  const huge = buklodComposerHeightLimits(8, 500, 'message');
  assert.deepEqual(normal, { minHeight: 42, maxHeight: 110 });
  assert.ok(large.maxHeight > normal.maxHeight);
  assert.ok(huge.maxHeight <= 180);
  assert.ok(huge.minHeight <= huge.maxHeight);
  assert.ok(buklodComposerHeightLimits(NaN, -Infinity, 'comment').maxHeight >= 150);
});
