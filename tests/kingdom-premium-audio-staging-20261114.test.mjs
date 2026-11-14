import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = new URL('../assets/sounds/kingdom-premium/', import.meta.url);
const expected = JSON.parse(read('assets/sounds/kingdom-premium/manifest.json'));

test('pin every CC0 recording and guard exact binary content', () => {
  for (const [file, spec] of Object.entries(expected)) {
    const u = new URL(file, base);
    assert.ok(existsSync(u), file + ' is missing: stage OTA forbidden');
    const bytes = readFileSync(u);
    assert.equal(bytes.length, spec.bytes, file + ' changed size');
    assert.equal(bytes.toString('ascii', 0, 4), file.endsWith('.ogg') ? 'OggS' : 'RIFF', file);
    if (file.endsWith('.wav')) assert.equal(bytes.toString('ascii', 8, 12), 'WAVE', file);
    const got = execFileSync('git', ['hash-object', u.pathname], {encoding:'utf8'}).trim();
    assert.equal(got, spec.sha, file + ' has an unexpected source SHA');
  }
});
test('runtime uses shipped premium music and SFX without accessing the old Rork audio host', () => {
  const premium = read('src/features/games/runtime/kingdomPremiumAudioAssets.ts');
  const runtime = read('src/features/games/runtime/rorkAudio.ts');
  const native = read('src/features/games/runtime/BuklodGameFeedback.native.ts');
  const practice = read('src/app/games/practice.tsx');
  for (const s of ['kingdom-theme.ogg','kingdom-village.ogg','kingdom-great-hall.ogg','victory.wav','collect-crystal.wav']) {
    assert.ok(premium.includes(s));
  }
  assert.match(runtime,/getPremiumKingdomMusic\(gameId, media\?\.ambience\)/);
  assert.match(runtime,/getPremiumKingdomSfx\(key\)/);
  assert.match(runtime,/focusedKingdomViews === 0/);
  assert.match(runtime,/releaseKingdomSfx\(\)/);
  assert.match(runtime,/if \(!gameId \|\| !musicEnabled\) return/);
  assert.match(runtime,/readyListener\.remove\(\)/);
  assert.match(native,/tryPlayRorkGameFeedback\(event, volume\)/);
  assert.match(practice,/useRorkGameAmbience\(gameId\)/);
  assert.match(practice,/ALL_IDS\.has\(gameParam\)/);
  assert.doesNotMatch(runtime,/createAudioPlayer\(RORK_AUDIO\[media\.ambience\]/);
  assert.equal((premium.match(/require\('\.\.\/\.\.\/\.\.\/\.\.\/assets\/sounds\/kingdom-premium\//g)??[]).length,15);
});
