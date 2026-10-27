/* Deterministic original BUKLOD sound pack; no external audio licenses. */
const fs = require('node:fs');
const path = require('node:path');

const RATE = 22050;
const OUT = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(OUT, { recursive: true });

function makeWav(name, duration, notes, gain = 0.26) {
  const frames = Math.ceil(duration * RATE);
  const pcm = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const t = i / RATE;
    let sample = 0;
    for (const note of notes) {
      const local = t - note.at;
      if (local < 0 || local >= note.for) continue;
      const attack = Math.min(1, local / 0.014);
      const release = Math.min(1, (note.for - local) / 0.085);
      const envelope = Math.max(0, Math.min(attack, release));
      const harmonic = Math.sin(2 * Math.PI * note.hz * local) +
        0.15 * Math.sin(2 * Math.PI * note.hz * 2 * local);
      sample += harmonic * envelope * (note.weight ?? 1);
    }
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample * gain)) * 32767), i * 2);
  }
  const wav = Buffer.alloc(44 + pcm.length);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(RATE, 24);
  wav.writeUInt32LE(RATE * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(pcm.length, 40);
  pcm.copy(wav, 44);
  fs.writeFileSync(path.join(OUT, name + '.wav'), wav);
}

const n = (at, hz, length, weight) => ({ at, hz, for: length, weight });
makeWav('buklod_message_sent', 0.22, [n(0, 740, .18)]);
makeWav('buklod_message', 0.5, [n(0, 620, .18), n(.17, 830, .24)]);
makeWav('buklod_submission', .7, [n(0, 520, .22), n(.19, 660, .23), n(.38, 880, .27)]);
makeWav('buklod_approval', .75, [n(0, 660, .2), n(.17, 830, .2), n(.35, 990, .35)]);
makeWav('buklod_error', .55, [n(0, 520, .22), n(.22, 390, .25)]);
makeWav('buklod_community', .4, [n(0, 510, .23), n(.13, 670, .22)]);
makeWav('buklod_achievement', .9, [n(0, 590, .24), n(.18, 740, .24), n(.36, 880, .4)]);
makeWav('buklod_alert', .85, [n(0, 470, .3), n(.42, 470, .3)]);
// Familiar telephone cadence: short double ring, with a silent pause. The
// caller's player loops it until Stream leaves RINGING.
makeWav('buklod_ringback', 4, [n(0, 440, .45), n(0, 480, .45, .25), n(.66, 440, .45), n(.66, 480, .45, .25)], .17);
