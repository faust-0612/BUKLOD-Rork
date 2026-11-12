import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const hub = read('src/app/(tabs)/hub.tsx');
const board = read('src/components/BuklodSystemAnnouncementBoard.tsx');
const drawer = read('src/components/SmartDrawerWallCard.tsx');

test('canonical Home preserves updates toggle and Wall navigation without a Quiz shortcut', () => {
  assert.match(hub, /const Updates = lazy/);
  assert.match(hub, /setUpdatesOpen\(value => !value\)/);
  assert.match(hub, /accessibilityLabel="Announcements and bulletins"/);
  assert.match(hub, /router\.push\('\/buklod'\)/);
  assert.doesNotMatch(hub, /Quiz/i);
  assert.doesNotMatch(board, /BuklodQuizStudentEntry|publicQuizDoor/);
});

test('Drawer retains its existing purpose and receives no Quiz launcher or route', () => {
  assert.match(drawer, /router\.push\('\/drawer' as any\)/);
  assert.doesNotMatch(drawer, /BuklodQuizStudentEntry|BUKLOD Quiz|\/quiz\b/i);
});
