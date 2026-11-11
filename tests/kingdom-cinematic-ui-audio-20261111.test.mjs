import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('Kingdom remains interactive with exactly 13 canonical routes and fit controls', () => {
  const m = read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx');
  assert.equal((m.match(/\{ id: '[a-z-]+', character:/g) ?? []).length, 13);
  assert.match(m, /<KingdomStation/);
  assert.match(m, /onPress=\{\(\) => onEnter\(station\)\}/);
  assert.match(m, /setPanelExpanded\] = useState\(false\)/);
  assert.match(m, /setMode\(current => current === 'detail' \? 'fit' : 'detail'\)/);
  assert.match(m, /<IllustratedRealm mapWidth=\{mapWidth\} mapHeight=\{mapHeight\} stage=\{stage\}/);
  assert.doesNotMatch(m, /playBuklodGameFeedback\('move'\)/);
  assert.doesNotMatch(m, /playBuklodGameFeedback\('unlock'\)/);
});
test('Kingdom ambience is local, opt-in, persisted, respects sound settings and cleans up on exit', () => {
  const a = read('src/features/games/runtime/rorkAudio.ts');
  assert.match(a, /buklod-kingdom-cinematic-ambient\.wav/);
  assert.match(a, /useState\(!isKingdomMap\)/);
  assert.match(a, /gameId === 'kingdom-map'/);
  assert.match(a, /AsyncStorage\.getItem\(KINGDOM_AMBIENCE_SETTING_KEY\)/);
  assert.match(a, /AsyncStorage\.setItem\(KINGDOM_AMBIENCE_SETTING_KEY/);
  assert.match(a, /isBuklodGameSoundEnabled\(\)/);
  assert.match(a, /AppState\.addEventListener/);
  assert.match(a, /useFocusEffect\(useCallback\(\(\) => \{/);
  assert.match(a, /if \(!gameId \|\| !musicEnabled\) return/);
  assert.match(a, /active = false;\s*readyListener\.remove\(\);\s*stateListener\.remove\(\);\s*try \{ audio\.pause\(\); \}/);
  // Cached Expo Router screens stay mounted after navigating away:
  // a plain useEffect would leak ambience into Home / Wall / video playback.
  assert.doesNotMatch(a, /useEffect\(\(\) => \{\s*if \(!gameId \|\| !musicEnabled\)/);
  assert.match(a, /audio\.remove\(\)/);
  const wav = readFileSync(new URL('../assets/sounds/buklod-kingdom-cinematic-ambient.wav', import.meta.url));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.readUInt32LE(24), 16000);
  assert.equal(wav.readUInt32LE(40), wav.length - 44);
  assert.ok(Math.abs(wav.readInt16LE(44)) < 100);
  assert.ok(Math.abs(wav.readInt16LE(wav.length - 2)) < 100);
});
