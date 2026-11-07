import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createBuklodGameFeedbackLimiter } from '../src/features/games/runtime/feedbackThrottle.ts';
import { inspectKingdomStagingSource, verifyKingdomStagingArtifact } from '../scripts/kingdom-staging-preflight.mjs';

test('R11 feedback limiter bounds rapid move events without hiding terminal success/failure', () => {
  let time = 10_000;
  const allow = createBuklodGameFeedbackLimiter(() => time);
  assert.equal(allow('move'), true);
  assert.equal(allow('move'), false, 'duplicate fast move blocked');
  time += 55;
  assert.equal(allow('collect'), true, 'different event allowed after global gap');
  assert.equal(allow('impact'), false, 'non-terminal sound flood blocked');
  assert.equal(allow('success'), true, 'winning feedback cannot be suppressed by prior tap');
  assert.equal(allow('success'), false, 'terminal duplicate suppressed');
  time += 110;
  assert.equal(allow('move'), true, 'next legal move is allowed after cooldown');
  assert.equal(allow('failure'), true, 'loss is not blocked by prior move');
  time += 450;
  assert.equal(allow('failure'), true, 'failed round replay is allowed after cooldown');
});

test('R11 feedback limiter fails closed on invalid clock values and native player count is capped', () => {
  const fail = createBuklodGameFeedbackLimiter(() => NaN);
  assert.equal(fail('move'), false);
  const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const native = read('src/features/games/runtime/BuklodGameFeedback.native.ts');
  const web = read('src/features/games/runtime/BuklodGameFeedback.web.ts');
  assert.ok(native.includes('MAX_ACTIVE_FALLBACK_PLAYERS = 6'));
  assert.ok(native.includes('activeFallbackPlayers >= MAX_ACTIVE_FALLBACK_PLAYERS'));
  assert.ok(native.includes('activeFallbackPlayers = Math.max(0, activeFallbackPlayers - 1)'));
  assert.ok(native.includes('if (!allowFeedback(event)) return;'));
  assert.ok(web.includes('if (!allowFeedback(event)) return;'));
  assert.ok(native.includes('createAudioPlayer'));
});

test('R11 source-only staging gate recognizes the one correct Android staging-user profile', () => {
  const result = inspectKingdomStagingSource();
  assert.equal(result.ok, true, result.failures.join('; '));
  assert.equal(result.target.channel, 'staging-user');
  assert.equal(result.target.environment, 'preview');
  assert.equal(result.target.runtimeVersion, '1.3.2');
  assert.equal(result.target.package, 'org.mzbministry.buklod.staging');
  assert.equal(result.target.target, 'main');
  assert.equal(result.catalog.centers, 13);
  assert.equal(result.catalog.games, 39);
});

test('R11 staging evidence gate refuses outdated or wrong-channel APKs, without deploying', () => {
  const src = inspectKingdomStagingSource();
  assert.equal(src.ok, true);
  const commit = 'a'.repeat(40);
  const valid = {
    artifactId: 'test-fixture-not-a-real-apk',
    easProjectId: src.target.easProjectId,
    channel: 'staging-user',
    environment: 'preview',
    runtimeVersion: '1.3.2',
    package: 'org.mzbministry.buklod.staging',
    platform: 'android',
    sourceCommit: commit,
    buildCreatedAt: new Date().toISOString(),
    evidenceUrl: 'https://expo.dev/accounts/test/projects/test/builds/test-fixture',
  };
  assert.equal(verifyKingdomStagingArtifact(valid, commit, src).ok, true);
  assert.equal(verifyKingdomStagingArtifact({ ...valid, channel: 'production' }, commit, src).ok, false);
  assert.equal(verifyKingdomStagingArtifact({ ...valid, environment: 'production' }, commit, src).ok, false);
  assert.equal(verifyKingdomStagingArtifact({ ...valid, runtimeVersion: '1.3.4' }, commit, src).ok, false);
  assert.equal(verifyKingdomStagingArtifact({ ...valid, package: 'org.mzbministry.buklod' }, commit, src).ok, false);
  assert.equal(verifyKingdomStagingArtifact({ ...valid, sourceCommit: 'b'.repeat(40) }, commit, src).ok, false);
  assert.equal(verifyKingdomStagingArtifact({ ...valid, buildCreatedAt: '2020-01-01T00:00:00Z' }, commit, src).ok, false);
  assert.equal(verifyKingdomStagingArtifact(null, commit, src).ok, false);
  assert.equal(verifyKingdomStagingArtifact(valid, 'bad-sha', src).ok, false);
});
