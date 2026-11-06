import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');
const deck = read('src/components/dzas/DzasSignalDeck.tsx');
const native = read('src/app/personal-home/radio.tsx');
const web = read('src/app/personal-home/radio.web.tsx');
const player = read('src/lib/buklodDzasRadio.ts');

test('Hero and control layout are real, responsive, and accessible', () => {
  assert.match(deck, /DZAS Signal Deck/);
  assert.match(deck, /source=\{DZAS_LOGO_IMAGE\}/);
  assert.match(deck, /source=\{DZAS_PORTRAIT_IMAGE\}/);
  assert.match(deck, /playing \? 'Pause Live' : 'Listen Live'/);
  assert.match(deck, /disabled=\{busy\}/);
  assert.match(deck, /onPress=\{playing \? onPause : onPlay\}/);
  assert.match(deck, /accessibilityLabel="Retry live stream"/);
  assert.match(deck, /onPress=\{onFavorite\}/);
  assert.match(deck, /getPhilippineProgramDay/);
  assert.ok(deck.includes("timeZone: 'Asia/Manila'"));
  assert.match(deck, /<ScrollView horizontal/);
  assert.match(deck, /styles\.feedRow/);
  assert.match(deck, /styles\.sectionRule/);
});

test('Program guide matches verified official station and does not fake current live show', () => {
  assert.ok(deck.includes('https://dzas.febc.ph/on-air-programs/'));
  assert.ok(deck.includes('https://dzas.febc.ph/'));
  assert.ok(deck.includes('https://www.facebook.com/702DZAS/'));
  assert.ok(deck.includes('info@dzas.febc.ph'));
  assert.match(deck, /'Oras Na Pilipinas'/);
  assert.match(deck, /'Karunungang Buhay'/);
  assert.match(deck, /'Hardin ng Panalangin'/);
  assert.match(deck, /Published DZAS guide, subject to station changes/);
  assert.match(deck, /playing \? 'ON AIR' : busy \|\| buffering/);
  assert.doesNotMatch(deck, /sponsored by 702 DZAS/i);
  assert.match(deck, /Updates open at the source/);
});

test('Native waits for loaded source and confirmed playback before resolving first tap', () => {
  assert.match(native, /useAudioPlayerStatus\(player\)/);
  assert.match(native, /playDzasRadio\(forceReload\)/);
  assert.match(native, /onPlay=\{\(\) => void play\(false\)\}/);
  assert.match(native, /onRetry=\{\(\) => void play\(true\)\}/);
  assert.match(native, /onPause=\{pause\}/);
  assert.match(native, /DZAS_FAVORITE_KEY/);
  assert.match(native, /<BuklodAdMobBanner/);
  assert.match(native, /format="mediumRectangle"/);
  assert.match(native, /requireViewport/);
  assert.match(player, /shouldPlayInBackground: true/);
  assert.match(player, /setActiveForLockScreen/);
  assert.match(player, /waitUntilLoaded/);
  assert.match(player, /waitUntilPlaying/);
  assert.match(player, /audio\.play\(\);\s*await waitUntilPlaying\(audio\)/);
  assert.match(player, /LOAD_TIMEOUT_MS = 12000/);
  assert.match(player, /PLAY_TIMEOUT_MS = 12000/);
  assert.match(player, /await startAttempt\(audio, true\)/);
  assert.match(player, /if \(playRequest\) return playRequest/);
  assert.doesNotMatch(player, /while \(!audio\.isLoaded && Date\.now\(\) - startedAt < 7000\)[\s\S]*?\n}\n\nfunction activateMediaControls/);
  assert.doesNotMatch(deck, /BannerAd.*unitId/);
});

test('Web keeps browser user-gesture audio and cleanup, with no native AdMob import', () => {
  assert.match(web, /const promise = audio\.play\(\)/);
  assert.match(web, /audio\.addEventListener\('error'/);
  assert.match(web, /audio\.removeEventListener\('playing'/);
  assert.match(web, /onPlay=\{\(\) => void play\(false\)\}/);
  assert.match(web, /onRetry=\{\(\) => void play\(true\)\}/);
  assert.doesNotMatch(web, /react-native-google-mobile-ads/);
});
