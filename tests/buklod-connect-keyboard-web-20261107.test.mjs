import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('desktop Connect Enter sends through same canonical onSend as Send button', () => {
  const composer = read('src/components/connect/ConnectComposer.tsx');
  const thread = read('src/components/BuklodConnectThread.tsx');
  assert.match(composer, /const sendFromDesktopKeyboard = \(\) => \{/);
  assert.match(composer, /if \(Platform\.OS !== 'web' \|\| !hasMessagePayload\) return/);
  assert.match(composer, /onKeyPress=\{Platform\.OS === 'web'/);
  assert.match(composer, /key !== 'Enter' \|\| shifted \|\| composing/);
  assert.match(composer, /e\.preventDefault\?\.\(\)/);
  assert.match(composer, /onSubmitEditing=\{Platform\.OS === 'web' \? sendFromDesktopKeyboard/);
  assert.match(composer, /lastKeyboardSendRef\.current < 250/);
  assert.match(composer, /onPress=\{hasMessagePayload \? onSend/);
  assert.match(thread, /<ConnectComposer/);
});
test('Enter does not send on native, blank draft, shift newline or composition', () => {
  const source = read('src/components/connect/ConnectComposer.tsx');
  assert.match(source, /Platform\.OS !== 'web' \|\| !hasMessagePayload/);
  assert.match(source, /key !== 'Enter' \|\| shifted \|\| composing \|\| e\.nativeEvent\?\.repeat/);
  assert.match(source, /multiline/);
  assert.match(source, /blurOnSubmit=\{false\}/);
});
