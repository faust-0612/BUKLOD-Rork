import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const board = read('src/components/BuklodSystemAnnouncementBoard.tsx');
const hub = read('src/app/(tabs)/hub.tsx');
const classroom = read('src/app/profile/buklod-classrooms.tsx');
const connection = read('src/components/BuklodConnectThread.tsx');
const bubble = read('src/components/connect/ConnectMessageBubble.tsx');
const workflow = read('.github/workflows/unified_rc_compiled_qa_20261108.yml');

test('Home academic Quiz card removed; Classroom entry stays available', () => {
  assert.doesNotMatch(board, /publicQuizDoor|BuklodQuizStudentEntry/);
  assert.doesNotMatch(hub, /Quiz & Bulletins|Quiz and [Bb]ulletins/i);
  assert.match(classroom, /<BuklodQuizStudentEntry\s*\/>/);
});

test('Cluster Seen/Sent uses authenticated server message and foreground cursor', () => {
  assert.match(connection, /roomReadFocusedRef/);
  assert.match(connection, /hasConfirmedDelivery/);
  assert.match(connection, /AppState\.currentState !== 'active'/);
  assert.doesNotMatch(bubble, /Seen by 0/);
});

test('compiled RC scope remains no-publish with identity and exact branch', () => {
  assert.match(workflow, /integration\/buklod-nov12-next-conso-rc-20261112-quiz-media-seen/);
  for (const value of [
    'org.mzbministry.buklod', '1.3.2',
    '23dad7d0-389a-406e-8dec-08965dab85d8',
    'npx expo export --platform android', 'npx expo export --platform web'
  ]) assert.ok(workflow.includes(value), 'Missing compile invariant: ' + value);
});
