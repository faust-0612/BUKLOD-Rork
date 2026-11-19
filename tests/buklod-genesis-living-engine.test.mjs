import test from 'node:test';
import assert from 'node:assert/strict';
import { GENESIS_PALETTE, GENESIS_MOTION_MS, getGenesisExperience, isGenesisPreviewEnabled, resolveGenesisMotion } from '../src/features/season2/genesis/genesisContract.ts';
import { resolveGenesisAudioPermission } from '../src/features/season2/genesis/genesisAudioPolicy.ts';

test('Genesis preview stays disabled by default and on ALL production builds', () => {
  for (const env of [undefined, '', 'production', 'prod']) {
    assert.equal(isGenesisPreviewEnabled('true', env), false);
  }
  assert.equal(isGenesisPreviewEnabled('true', 'staging'), true);
  assert.equal(isGenesisPreviewEnabled('true', 'preview'), true);
  assert.equal(isGenesisPreviewEnabled(undefined, 'staging'), false);
});
test('reduced motion and inactive scenes stop decorative motion', () => {
  const base = { surface: 'home', quality: 'full', focused: true, appActive: true, reducedMotion: false };
  assert.equal(resolveGenesisMotion(base).ambient, true);
  assert.equal(resolveGenesisMotion(base).particles, true);
  for (const override of [{ reducedMotion: true }, { appActive: false }, { focused: false }, { videoPlaying: true }, { callActive: true }, { powerSave: true }]) {
    assert.equal(resolveGenesisMotion({ ...base, ...override }).ambient, false);
  }
  assert.equal(resolveGenesisMotion({ ...base, surface: 'connect' }).ambient, false);
  assert.equal(resolveGenesisMotion({ ...base, quality: 'minimal' }).particles, false);
});
test('social media, calls and ads never play Genesis ambient audio', () => {
  const base = { surface: 'kingdom', enabledByUser: true, approvedAsset: true,
    foreground: true, sceneFocused: true, otherMediaPlaying: false, callActive: false, adVisible: false };
  assert.equal(resolveGenesisAudioPermission(base).allowed, true);
  for (const surface of ['wall', 'connect', 'reels', 'call', 'ad']) {
    assert.equal(resolveGenesisAudioPermission({ ...base, surface }).allowed, false);
  }
  for (const flag of [{ enabledByUser: false }, { approvedAsset: false }, { foreground: false },
    { sceneFocused: false }, { otherMediaPlaying: true }, { callActive: true }, { adVisible: true },
    { reducedAudio: true }]) {
    assert.equal(resolveGenesisAudioPermission({ ...base, ...flag }).allowed, false);
  }
});
test('theme identity and route experiences are stable', () => {
  for (const hex of Object.values(GENESIS_PALETTE)) {
    assert.ok(/^#[A-Fa-f0-9]{6}$/.test(hex) || hex.startsWith('rgba('));
  }
  assert.ok(GENESIS_MOTION_MS.navigation < 250);
  assert.equal(getGenesisExperience('reward'), 'verified-cinematic-reveal');
  assert.equal(getGenesisExperience('wall'), 'subtle-line-accents-no-ambient-music');
});
