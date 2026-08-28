/**
 * Tiny looping PCM WAVs for Bible dramatized ambience.
 * Subtle textures only — narration stays primary.
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 16000;
const outDir = path.join(__dirname, '..', 'assets', 'bible-ambience');

function clamp16(value) {
  return Math.max(-32767, Math.min(32767, Math.round(value)));
}

function writeWav(fileName, samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i += 1) {
    buffer.writeInt16LE(clamp16(samples[i]), 44 + i * 2);
  }
  fs.writeFileSync(path.join(outDir, fileName), buffer);
}

function makeSamples(seconds, fn) {
  const n = Math.floor(SAMPLE_RATE * seconds);
  const samples = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    samples[i] = fn(i, n);
  }
  return samples;
}

function rand(seedObj) {
  seedObj.s = (seedObj.s * 16807) % 2147483647;
  return (seedObj.s / 2147483647) * 2 - 1;
}

function fadeLoop(samples, fade = 800) {
  const n = samples.length;
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let g = 1;
    if (i < fade) g *= i / fade;
    if (i > n - fade) g *= (n - i) / fade;
    out[i] = samples[i] * g;
  }
  return out;
}

function toPcm(samples, gain) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    out[i] = clamp16(samples[i] * gain * 32767);
  }
  return out;
}

fs.mkdirSync(outDir, { recursive: true });

{
  const seed = { s: 17 };
  let brown = 0;
  const raw = makeSamples(3.2, () => {
    brown = brown * 0.97 + rand(seed) * 0.03;
    return brown;
  });
  writeWav('wind.wav', toPcm(fadeLoop(raw), 0.22));
}

{
  const seed = { s: 91 };
  const raw = makeSamples(2.8, (i) => {
    const hiss = rand(seed) * 0.55;
    const drop = rand(seed) > 0.97 ? rand(seed) * 0.9 : 0;
    const patter = Math.sin(i * 0.37) * 0.08;
    return hiss * 0.7 + drop + patter;
  });
  writeWav('rain.wav', toPcm(fadeLoop(raw, 600), 0.18));
}

{
  const seed = { s: 44 };
  let brown = 0;
  const raw = makeSamples(4.0, (i) => {
    brown = brown * 0.985 + rand(seed) * 0.015;
    const swell = 0.55 + 0.45 * Math.sin((2 * Math.PI * i) / (SAMPLE_RATE * 3.4));
    const foam = rand(seed) * 0.04;
    return brown * swell + foam;
  });
  writeWav('sea.wav', toPcm(fadeLoop(raw, 1200), 0.24));
}

{
  const seed = { s: 123 };
  const raw = makeSamples(3.0, (i) => {
    const murmur = rand(seed) * 0.25;
    const voice = Math.sin(i * 0.021) * 0.05 + Math.sin(i * 0.013) * 0.04;
    const swell = 0.7 + 0.3 * Math.sin(i / 9000);
    return (murmur + voice) * swell;
  });
  writeWav('crowd.wav', toPcm(fadeLoop(raw), 0.16));
}

{
  const seed = { s: 7 };
  let brown = 0;
  const raw = makeSamples(4.2, (i) => {
    brown = brown * 0.99 + rand(seed) * 0.01;
    let tick = 0;
    if (i % 18000 > 17600 && rand(seed) > 0.4) {
      tick = Math.sin(i * 0.9) * 0.12 * Math.exp(-((i % 18000) - 17600) / 40);
    }
    return brown * 0.55 + tick;
  });
  writeWav('night.wav', toPcm(fadeLoop(raw, 1000), 0.14));
}

{
  const seed = { s: 3 };
  const raw = makeSamples(1.35, (i, n) => {
    const t = i / n;
    const env = Math.exp(-t * 3.2) * (1 - t);
    const rumble = Math.sin(i * 0.018) * 0.7 + Math.sin(i * 0.011) * 0.5;
    const crack = t < 0.12 ? rand(seed) * (0.12 - t) * 4 : 0;
    return (rumble + crack) * env;
  });
  writeWav('thunder.wav', toPcm(raw, 0.28));
}

{
  const raw = makeSamples(0.7, (i) => {
    const t = i / SAMPLE_RATE;
    const thump = (at) => {
      const x = t - at;
      if (x < 0 || x > 0.12) return 0;
      return Math.sin(2 * Math.PI * 62 * x) * Math.exp(-x * 38);
    };
    return thump(0.05) * 0.9 + thump(0.38) * 0.7;
  });
  writeWav('footsteps.wav', toPcm(raw, 0.22));
}

console.log('Wrote Bible ambience WAVs to', outDir);
