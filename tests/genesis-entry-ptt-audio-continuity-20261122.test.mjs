import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read = p => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

test('PTT speech is transient and does not seize permanent music focus', () => {
  const focus = read('src/lib/buklodAudioFocus.ts');
  const runtime = read('src/ptt/buklodPttRuntime.ts');
  assert.match(focus, /export function subscribeBuklodPttVoiceActivity/);
  assert.match(focus, /if \(pttVoiceActive === value\) return/);
  assert.match(runtime, /setBuklodPttVoiceActive\(Boolean\(/);
  assert.match(runtime, /state\.requestingFloor \|\| state\.transmitting/);
  assert.match(runtime, /state\.priorityReceiving \|\| normalReceivingTransmissionId/);
  assert.match(runtime, /handleNormalReceivingStart\(payload\)/);
  assert.match(runtime, /clearNormalReceiving\(String\(payload\.transmission_id\)\)/);
  assert.match(runtime, /setTimeout\(\(\) => clearNormalReceiving\(id\), 90000\)/);
  assert.match(runtime, /export async function shutdownBuklodPttRuntime\(\)[\s\S]*?clearNormalReceiving\(\)/);
});
test('Genesis player mixes on Android, ducks without restart, and unsubscribes on blur', () => {
  const audio = read('src/features/games/runtime/rorkAudio.ts');
  assert.match(audio, /if \(isKingdomMap && Platform\.OS === 'android'\)/);
  assert.match(audio, /interruptionMode: 'mixWithOthers'/);
  assert.match(audio, /audio\.volume = isKingdomMap && pttVoiceActive \? base \* 0\.12 : base/);
  assert.match(audio, /if \(audio\.isLoaded && !audio\.playing\) audio\.play\(\)/);
  assert.match(audio, /releasePttActivity\(\)/);
  assert.match(audio, /active = false/);
});

test('installed Godot 2.0.4 staging OTA scope keeps PTT audio fixes and guarded release evidence', () => {
  const manifest=JSON.parse(read('.buklod/scopes/genesis-library-204-conso-ota-20261122.json'));
  const qa=read('.github/workflows/genesis-library-204-staging-ota-qa.yml');
  const publisher=read('.github/workflows/genesis-library-204-staging-ota-publish.yml');
  for(const p of [
    'src/lib/buklodAudioFocus.ts',
    'src/ptt/buklodPttRuntime.ts',
    'src/features/games/runtime/rorkAudio.ts',
    'tests/genesis-entry-ptt-audio-continuity-20261122.test.mjs'
  ]) assert.ok(manifest.allowedPaths.includes(p),p);
  assert.ok(manifest.regressionTests.includes('tests/genesis-entry-ptt-audio-continuity-20261122.test.mjs'));
  assert.match(qa,/tests\/genesis-entry-ptt-audio-continuity-20261122\.test\.mjs/);
  assert.match(publisher,/tests\/genesis-entry-ptt-audio-continuity-20261122\.test\.mjs/);
  assert.equal(manifest.releaseMode,'STAGING_ANDROID_JS_OTA_ONLY');
  assert.match(publisher,/c413c1ec2e23f151af0123cefbd4209fbf612d1f/);
});
