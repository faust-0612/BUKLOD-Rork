import fs from 'node:fs';

const GAME_IDS = [
  'jawo-forest-trail',
  'trudice-playground-memory',
  'ace-rescue-grid',
  'mitch-restore-mural',
  'niel-mission-trail',
  'angel-kingdom-treasury',
  'vhen-farm-to-market',
  'elesur-village-builder',
  'phan-enterprise-builder',
  'van-living-city-dispatch',
  'christian-civic-leadership',
  'lhen-rhythm-journey',
  'quin-discovery-expedition',
];

const registry = fs.readFileSync('src/features/games/registry.ts', 'utf8');
const media = fs.readFileSync('src/features/games/runtime/rorkMedia.ts', 'utf8');
const audio = fs.readFileSync('src/features/games/runtime/rorkAudio.ts', 'utf8');

const failures = [];
for (const id of GAME_IDS) {
  if (!registry.includes(`'${id}'`)) failures.push(`Registry missing canonical game: ${id}`);
  if (!media.includes(`'${id}'`)) failures.push(`Rork media mapping missing canonical game: ${id}`);
}

for (const token of [
  'RORK_GAME_MEDIA',
  'RORK_AUDIO',
  'kp3ge50a5t6chyb7gv3jn-web.rork.live/kingdom',
  'const AUDIO_BASE = `${RORK_PUBLIC_BASE}/audio`',
  'https://r2-pub.rork.com/projects/kp3ge50a5t6chyb7gv3jn/assets/',
]) {
  if (!media.includes(token)) failures.push(`rorkMedia.ts missing token: ${token}`);
}

for (const token of [
  'createAudioPlayer',
  'downloadFirst: true',
  'player.isLoaded',
  'tryPlayRorkGameFeedback',
  'playRorkSignatureSfx',
  'useRorkGameAmbience',
  'const REMOTE_RORK_AUDIO_ENABLED = false',
]) {
  if (!audio.includes(token)) failures.push(`rorkAudio.ts missing token: ${token}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  console.error(`\nRORK MEDIA CONTRACT FAILED with ${failures.length} blocker(s).`);
  process.exit(1);
}

console.log('RORK MEDIA CONTRACT PASSED.');
console.log('13/13 canonical games mapped; media endpoint and audio fallback readiness contract intact.');
