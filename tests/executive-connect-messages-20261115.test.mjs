
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('Connect messages preserve all native messaging and theme colors',()=>{
 const thread=source('src/components/BuklodConnectThread.tsx');
 assert.match(thread,/backgroundColor:\s*theme\.bubbleReceived/);
 assert.match(thread,/color: theme\.textOnSentBubble/);
 assert.match(thread,/backgroundColor: theme\.pickerSheet/);
 assert.match(thread,/gifPickerButtonText:\s*\{\s*color: theme\.onAccent/);
 assert.match(thread,/markVisibleRoomRead\('returned-to-latest'\)/);
 assert.match(thread,/CONNECT_COMPOSER_RESERVED_HEIGHT/);
 const m=source('src/lib/messagesTheme.ts');
 assert.match(m,/textOnSentBubble: onSent/);
 assert.match(m,/unreadBadgeText: accessibleTextOn\(p\.unreadBadge\)/);
});
