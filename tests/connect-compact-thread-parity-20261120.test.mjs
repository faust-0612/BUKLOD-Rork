import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const scope = read('src/app/scope/index.tsx');
const thread = read('src/components/BuklodConnectThread.tsx');
const bubble = read('src/components/connect/ConnectMessageBubble.tsx');
const window = read('src/lib/connectChatWindow.ts');

test('native Cluster and Organization Connect use the full shared chat viewport, preserving web shell', () => {
  assert.match(scope, /Platform\.OS !== 'web'[\s\S]*section === 'connect'/);
  assert.match(scope, /\{!showFullConnectThread && \(\s*<BuklodScopedDashboardHeader/);
  assert.match(scope, /\{!showFullConnectThread && \(\s*<View\s+style=\{\[\[\s*styles\.tabs/);
  assert.match(scope, /fullHeaderInWorkspace=\{Platform\.OS !== 'web'\}/);
  assert.match(thread, /compactEmbedded=\{embeddedInWorkspace && !fullHeaderInWorkspace\}/);
  assert.match(thread, /embeddedInWorkspace && !fullHeaderInWorkspace\s*\? 4\s*: Math\.max\(insets\.top, 12\)/);
  assert.match(thread, /onBackOverride=\{onBack\}/);
});

test('every message renders a tiny local weekday and send time without hiding delivery status', () => {
  assert.match(window, /export function formatConnectMessageMicroTime/);
  assert.match(window, /Number\.isFinite\(sent\.getTime\(\)\)/);
  assert.match(window, /toLocaleDateString\('en-PH', \{ weekday: 'short' \}\)/);
  assert.match(window, /toLocaleTimeString\('en-PH', \{ hour: 'numeric', minute: '2-digit' \}\)/);
  assert.match(thread, /showTime=\{true\}/);
  assert.match(thread, /microTimeLabel=\{formatConnectMessageMicroTime\(item\.created_at\)\}/);
  assert.match(bubble, /\(showTime \|\| detailsExpanded \|\| !!deliveryLabel\)/);
  assert.match(bubble, /detailsExpanded \? timeLabel : \(microTimeLabel \|\| timeLabel\)/);
  assert.match(bubble, /\{!!deliveryLabel && \(/);
});

test('message density, shared seen readers and all existing actions remain', () => {
  assert.match(bubble, /paddingVertical: 4,\s*borderRadius: 18/);
  assert.match(bubble, /fontSize: 15,\s*lineHeight: 20/);
  assert.match(bubble, /seenRow: \{[\s\S]*?gap: 1,[\s\S]*?minHeight: 24/);
  assert.match(bubble, /seenAvatar: \{\s*width: 25,\s*height: 24/);
  for (const expression of [/visibleReaderAvatars\(/, /onPressSeenReaders/, /onLongPress=\{handleLongPress\}/, /ConnectReactionPicker/, /onOpenPhoto/, /onRetryPhoto/]) {
    assert.match(bubble, expression);
  }
  for (const expression of [/roomCursorCoversMessage/, /readersForMessageWindow/, /retryFailedMessage/, /formatConnectTimestamp\(item\.created_at\)/]) {
    assert.match(thread, expression);
  }
});
