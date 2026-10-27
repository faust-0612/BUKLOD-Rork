const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const soundNames = [
  'buklod_message_sent', 'buklod_message', 'buklod_submission',
  'buklod_approval', 'buklod_error', 'buklod_community',
  'buklod_achievement', 'buklod_alert', 'buklod_ringback',
  'buklod_incoming_call',
];

test('original BUKLOD sound pack includes valid, short, audible WAVs', () => {
  for (const name of soundNames) {
    const file = fs.readFileSync(path.join(root, 'assets', 'sounds', name + '.wav'));
    assert.equal(file.toString('ascii', 0, 4), 'RIFF', name);
    assert.equal(file.toString('ascii', 8, 12), 'WAVE', name);
    assert.equal(file.readUInt16LE(22), 1, name);
    assert.equal(file.readUInt16LE(34), 16, name);
    const duration = file.readUInt32LE(40) / file.readUInt32LE(28);
    assert.ok(duration > 0.12 && duration < 30, name);
    let audible = false;
    for (let i = 44; i < file.length; i += 2) {
      if (Math.abs(file.readInt16LE(i)) > 100) { audible = true; break; }
    }
    assert.ok(audible, name);
  }
});

test('Stream native ringing is configured without a duplicate incoming JS player', () => {
  const nativeConfig = read('app.config.js');
  const pushConfig = read('src/utils/setPushConfig.ts');
  const ringScreen = read('src/components/RingingCalls.tsx');
  assert.match(nativeConfig, /androidRingtone:.*buklod_incoming_call\.wav/);
  assert.match(nativeConfig, /iosRingtone:.*buklod_incoming_call\.wav/);
  assert.match(pushConfig, /buklod_incoming_calls_v3/);
  assert.match(ringScreen, /call\?\.isCreatedByMe/);
  assert.match(ringScreen, /CallingState\.RINGING/);
  assert.match(ringScreen, /player\.pause\(\)/);
});

test('feedback is tied to send/submission success, with settings and cooldowns', () => {
  const cues = read('src/lib/buklodSounds.ts');
  const messages = read('src/components/BuklodConnectThread.tsx');
  const classroom = read('src/app/profile/buklod-classroom-work.tsx');
  const profile = read('src/app/(tabs)/me.tsx');
  assert.match(cues, /const cooldownMs/);
  assert.match(cues, /AppState\.currentState !== 'active'/);
  assert.match(cues, /setBuklodCallSoundSuppressed/);
  assert.match(messages, /markLocalMessageSent/);
  assert.match(messages, /playBuklodCue\('message_sent'\)/);
  assert.match(classroom, /playBuklodCue\('submission'\)/);
  assert.match(classroom, /playBuklodCue\('error'\)/);
  assert.match(profile, /\/settings\/sounds/);
});
