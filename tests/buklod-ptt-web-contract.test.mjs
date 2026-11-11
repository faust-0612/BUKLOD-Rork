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
  assert.match(web, /onPressIn=\{start\}/);
  assert.match(web, /onPressOut=\{stop\}/);
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
