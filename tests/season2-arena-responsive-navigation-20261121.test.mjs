import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const arena = readFileSync(new URL('../src/app/games/empire-arena.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../src/components/BuklodNavSafeShell.tsx', import.meta.url), 'utf8');

test('landscape arena menu scrolls and no longer centers unbounded content', () => {
  assert.match(arena, /<ScrollView style={styles\.menuScroll}/);
  assert.match(arena, /compactLandscape && styles\.menuCompact/);
  assert.doesNotMatch(arena, /menu: \{[^\n]*flex: 1[^\n]*justifyContent: 'center'/);
});
test('arena supports bounded pinch, zoom in, zoom out and reset', () => {
  assert.match(arena, /onTouchMove=\{event =>/);
  assert.match(arena, /onPinchZoom\(factor\)/);
  assert.match(arena, /clamp\(z \* factor, 0\.65, 2\.6\)/);
  for (const label of ['Zoom in battlefield', 'Zoom out battlefield', 'Reset battlefield zoom'])
    assert.ok(arena.includes(label), label);
  assert.match(arena, /\) \/ zoom\);/);
});
test('game controls and actors respect short landscape height', () => {
  for (const token of ['styles.topCompact','<ArenaCombatHud', 'hudArea.height',
    'styles.tacticsCompact','styles.minimapCompact','area.height * 0.36'])
    assert.ok(arena.includes(token), token);
});
test('global nav, ads and floating map return never cover the Arena', () => {
  assert.match(shell, /immersiveArena = normalizeBuklodPathname\(pathname\) === '\/games\/empire-arena'/);
  assert.match(shell, /!immersiveIgpat && !immersiveArena \? <BuklodFocusAppAdStrip/);
  assert.match(shell, /!immersiveArena && !keyboardVisible/);
  assert.match(shell, /!immersiveIgpat && !immersiveConversation && rawNavOccupied > 0 && !immersiveArena/);
});
test('practice remains isolated from reward balances and ranked stays gated', () => {
  assert.match(arena, /diamonds: 0, verifiedItems: \[\]/);
  assert.match(arena, /isArenaRankedConfigured\(\)/);
  assert.match(arena, /!isGenesisPreviewBuild\(\)/);
});
