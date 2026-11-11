import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const web = source('src/app/personal-home/ptt.web.tsx');
const core = source('src/ptt/buklodPttCore.web.ts');
const native = source('src/ptt/buklodPttCore.ts');
const door = source('src/components/BuklodPttEntryButton.web.tsx');
const chat = source('src/components/BuklodPttConversation.tsx');
const runtime = source('src/ptt/buklodPttRuntime.ts');

test('Web route exposes actual PTT with authorized channels and browser audio', () => {
  assert.match(web, /BUKLOD_PTT_WEB_LIVE_R1/);
  assert.doesNotMatch(web, /currently available in the BUKLOD Android app/);
  assert.match(web, /loadBuklodPttScopes/);
  assert.match(web, /connectBuklodPttRuntime/);
  assert.match(web, /disconnectBuklodPttRuntime/);
  // A raw browser pointer-captured button avoids Pressable's delayed touch
  // handling inside the scrolling PTT page.
  assert.match(web, /onPointerDown: pointerDown/);
  assert.match(web, /onPointerUp: pointerUp/);
  assert.match(web, /onPointerCancel: stop/);
  assert.match(web, /onLostPointerCapture: stop/);
  assert.match(web, /onBlur: stop/);
  assert.match(web, /setPointerCapture/);
  assert.match(web, /releasePointerCapture/);
  assert.match(web, /touchAction: 'none'/);
  assert.match(web, /onKeyDown: keyDown/);
  assert.match(web, /onKeyUp: keyUp/);
  assert.doesNotMatch(web, /onPressIn=\{start\}/);
  assert.match(web, /visibilitychange/);
  assert.match(web, /pagehide/);
  assert.match(web, /bindAudioElement/);
  assert.match(web, /mediaDevices\?\.getUserMedia/);
  assert.match(web, /BuklodPttConversation/);
  assert.match(web, /CHANNELS = Array.from\(\{ length: 10 \}/);
});

test('Browser PTT core uses Stream WebRTC, same scoped authorization and PTT floor RPCs', () => {
  assert.match(core, /from '@stream-io\/video-client'/);
  assert.doesNotMatch(core, /video-react-native-sdk/);
  assert.match(core, /'buklod-ptt-access'/);
  assert.match(core, /getSecurePttAccess\(scope, channel\)/);
  assert.match(core, /await call\.get\(\)/);
  assert.match(core, /await call\.microphone\.disable\(\)/);
  assert.match(core, /await call\.join\(\)/);
  assert.match(core, /'buklod_ptt_claim_floor'/);
  assert.match(core, /'buklod_ptt_release_floor'/);
  assert.match(core, /'buklod_ptt_refresh_floor'/);
  assert.match(runtime, /if \(!stillHeld\(\)\)/);
  assert.match(runtime, /if \(!refreshed && state\.transmissionId === tx\)/);
  assert.match(native, /from '@stream-io\/video-react-native-sdk'/);
});

test('Web Home door remains visible, transcript consent works on browser', () => {
  assert.match(door, /router\.push\('\/personal-home\/ptt'/);
  assert.doesNotMatch(door, /return null/);
  assert.match(chat, /BrowserSafeAlert/);
  assert.match(chat, /window\.confirm/);
  assert.match(chat, /window\.alert/);
});

test('Web PTT button rejects phantom transmissions and always releases', () => {
  assert.match(web, /if \(!connected \|\| busyRef\.current \|\| holdRef\.current \|\| runtime\.requestingFloor \|\| runtime\.transmitting\) return/);
  assert.match(web, /if \(!event\.isPrimary \|\| event\.button !== 0\) return/);
  assert.match(web, /onPointerCancel: stop/);
  assert.match(web, /window\.addEventListener\('pointercancel', end\)/);
  assert.match(web, /window\.addEventListener\('pagehide', end\)/);
  assert.match(web, /document\.addEventListener\('visibilitychange', hidden\)/);
  assert.match(web, /disabled: !connected \|\| busy/);
  assert.match(web, /CONNECT FIRST/);
  assert.match(web, /'aria-pressed': held \|\| runtime\.transmitting/);
  assert.match(web, /\!window\.confirm\('SOS is only for emergencies/);
});

test('Web PTT button provides honest states with bounded action dispatch', () => {
  assert.match(web, /type PttWebAction = 'idle' \| 'joining' \| 'leaving' \| 'switching'/);
  assert.match(web, /busyRef\.current = true/);
  assert.match(web, /setAction\(connected \? 'leaving' : 'joining'\)/);
  assert.match(web, /setAction\('switching'\)/);
  assert.match(web, /setAction\('idle'\)/);
  assert.match(web, /describePttError/);
  assert.match(web, /Cannot reach the PTT service/);
  assert.match(web, /Press and hold/);
});
