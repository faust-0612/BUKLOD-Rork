import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const load = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const thread = load('src/components/BuklodConnectThread.tsx');
const composer = load('src/components/connect/ConnectComposer.tsx');

test('typing in personal and scope Connect follows the newest message across IME reflow', () => {
  assert.match(thread, /composerFollowsLatestRef = useRef\(false\)/);
  assert.match(thread, /\[keyboardVisible, composerDockBottom, followComposerToLatest\]/);
  assert.match(thread, /onFocus=\{\(\) => \{\s*composerFollowsLatestRef\.current = true;/);
  assert.match(thread, /if \(composerFollowsLatestRef\.current && !userDraggingRef\.current && !userMomentumRef\.current\)/);
  assert.match(composer, /onFocus=\{onFocus\}/);
  assert.match(composer, /onBlur=\{onBlur\}/);
});

test('own sends keep the keyboard open and supersede older-history position', () => {
  assert.doesNotMatch(thread, /Keyboard\.dismiss\(\)/);
  assert.match(thread, /if \(followOwnSendRef\.current && pendingOlderAnchorRef\.current\)/);
  assert.match(thread, /const offset = connectOlderPrependScrollOffset\(anchor, height\)/);
  assert.match(thread, /onScrollBeginDrag=\{\(\) => \{ userDraggingRef\.current = true; \}\}/);
  assert.match(thread, /composerFollowsLatestRef\.current = false;/);
});

test('wider composer retains accessible file and photo flows', () => {
  assert.match(composer, /const ICON_SIZE = 44/);
  assert.match(composer, /const EMOJI_HIT_SIZE = 36/);
  assert.match(composer, /accessibilityLabel="Add photo or file"/);
  assert.doesNotMatch(composer, /accessibilityLabel="Attach photo"/);
  assert.match(composer, /onLongPress=\{onChoosePhoto\}/);
  assert.match(thread, /composerMeasuredHeight \+ composerDockBottom \+ 8/);
  assert.match(thread, /setComposerMeasuredHeight\(previous =>/);
  assert.match(thread, /composerDockBottom \+ composerMeasuredHeight \+ 10/);
});
