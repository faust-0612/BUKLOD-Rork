import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Connect keeps all authentication/read/call/message plumbing', () => {
 const src=read('src/components/BuklodConnectThread.tsx');
 for(const keep of ['useConnectTheme','ConnectThemeProvider','ConnectComposer','ConnectMessageBubble','ConnectMessageActionSheet','notifyConnectRead','buildBuklodPersonalCallId','supabase']) assert.ok(src.includes(keep),keep);
});
test('Chat palette surfaces and text are not hardcoded white on dark scheme', () => {
 const src=read('src/components/BuklodConnectThread.tsx');
 for(const safe of ['theme.bubbleSent','theme.bubbleReceived','theme.textOnSentBubble','theme.pickerSheet','theme.pickerTabActive','theme.surfaceElevated','theme.onAccent']) assert.ok(src.includes(safe),safe);
 assert.match(src,/modernPickerTabTextOn:[\s\S]*?color:\s*theme.textPrimary/);
 assert.match(src,/gifPickerButtonText:[\s\S]*?color:\s*theme.onAccent/);
 assert.match(read('src/lib/messagesTheme.ts'),/textOnSentBubble: onSent/);
});
