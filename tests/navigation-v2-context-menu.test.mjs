import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('compact contextual bottom sheet never blocks basic icon and tap navigation', () => {
  const ui = read('src/components/BuklodFeatureFinder.tsx');
  assert.match(ui, /<BuklodNavigationContextSheet/);
  assert.match(ui, /onLongPress=\{\(\) => setMenuItem\(item\)\}/);
  assert.match(ui, /accessibilityLabel=\{\`More options for \$\{item.title\}\`\}/);
  assert.match(ui, /accessibilityLabel=\{isPinned \?/);
  assert.match(ui, /onPress=\{\(\) => openAndRemember\(item\)\}/);
  assert.match(ui, /id: 'remove-recent'/);
  assert.match(ui, /id: pinned.includes\(menuItem.id\) \? 'unpin' : 'pin'/);
  assert.match(ui, /onPress=\{\(\) => togglePin\(item\)\}/);
});

test('context menu has dismissible backdrop, 48dp close, native Back and reduced-motion fallback', () => {
  const sheet = read('src/components/BuklodNavigationContextSheet.tsx');
  assert.match(sheet, /useBuklodReduceMotion\(\)/);
  assert.match(sheet, /animationType=\{reducedMotion \? 'none' : 'fade'\}/);
  assert.match(sheet, /onRequestClose=\{onClose\}/);
  assert.match(sheet, /accessibilityLabel="Dismiss options"/);
  assert.match(sheet, /accessibilityLabel="Close options"/);
  assert.match(sheet, /minWidth: 48, minHeight: 48/);
  assert.match(sheet, /onClose\(\);\s*action.onPress\(\)/);
});

test('private recent shortcuts support explicit removal and immediate storage without hidden long press', () => {
  const ui = read('src/components/BuklodFeatureFinder.tsx');
  assert.match(ui, /removeRecent = \(item: BuklodFeatureLink\)/);
  assert.match(ui, /AsyncStorage.setItem\(key, JSON.stringify\(next\)\)/);
  assert.match(ui, /More options for/);
  assert.match(ui, /Remove from recent/);
  assert.match(ui, /Pin to Home/);
});
