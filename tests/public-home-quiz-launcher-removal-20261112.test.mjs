import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const board = read('src/components/BuklodSystemAnnouncementBoard.tsx');
const hub = read('src/app/(tabs)/hub.tsx');
const merged = read('src/components/home/BuklodHomeMergedUpdates.tsx');
const classroom = read('src/app/profile/buklod-classrooms.tsx');

test('public Home announcement no longer injects BUKLOD Quiz in any loading or empty state', () => {
  assert.doesNotMatch(board, /BuklodQuizStudentEntry|publicQuizDoor|showPublicQuizDoor/);
  assert.match(board, /if \(loading\) \{\s*return null;/);
  assert.match(board, /if \(!canEdit\) \{\s*return null;/);
  assert.match(board, /loadSystemAnnouncementBoard\(slot\)/);
});

test('Home update panels remain functional but do not advertise Quiz', () => {
  assert.doesNotMatch(hub, /Quiz & Bulletins|Quiz and [Bb]ulletins|BUKLOD Quiz and Bulletins/);
  assert.match(hub, /Hide Updates & Bulletins/);
  assert.match(hub, /Announcements & Bulletins/);
  assert.match(hub, /<Updates \/>/);
  assert.match(merged, /<BuklodSystemAnnouncementBoard slot="public_home" \/>/);
  assert.match(merged, /<BuklodHomeScopeBulletins \/>/);
});

test('academic Quiz remains available via Classroom; no drawer routing introduced', () => {
  assert.match(classroom, /<BuklodQuizStudentEntry \/>/);
  assert.doesNotMatch(hub, /router\.push\([^\n]*quiz/i);
  assert.doesNotMatch(merged, /Drawer|BuklodQuizStudentEntry/);
});
