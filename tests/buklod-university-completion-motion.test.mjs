import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUKLOD_ACADEMIC_MOTION,
  getBuklodAcademicCompletionPresentation,
} from '../src/lib/buklodUniversityCompletionMotion.ts';

const valid = {
  awardId: '00000000-0000-4000-8000-000000000001',
  credentialCode: 'C-S01',
  title: 'Scripture Devotion',
  tier: 'certificate',
  status: 'ISSUED',
  issuedAt: '2026-11-24T01:00:00Z',
  paperReady: true,
};

test('shows only a genuinely issued academic completion receipt with ready paper', () => {
  assert.equal(getBuklodAcademicCompletionPresentation(valid)?.name, 'Emerald Bloom');
  for (const status of ['PENDING', 'ON_HOLD', 'REVOKED']) {
    assert.equal(getBuklodAcademicCompletionPresentation({ ...valid, status }), null);
  }
  assert.equal(getBuklodAcademicCompletionPresentation({ ...valid, paperReady: false })?.name, 'Emerald Bloom');
});

test('does not give diploma ceremony to a single lesson or mismatched award', () => {
  assert.equal(getBuklodAcademicCompletionPresentation({ ...valid, credentialCode: 'ABAKA-LESSON-01' }), null);
  assert.equal(getBuklodAcademicCompletionPresentation({ ...valid, tier: 'masters' }), null);
  assert.equal(getBuklodAcademicCompletionPresentation({ ...valid, title: ' ' }), null);
  assert.equal(getBuklodAcademicCompletionPresentation({ ...valid, awardId: 'x' }), null);
});

test('recognizes all four academic categories with distinctive bounded one-shot presets', () => {
  const fixtures = [
    ['certificate', 'C-R01'], ['diploma', 'D01'], ['bachelors', 'B01'], ['masters', 'M01'],
  ];
  const names = new Set();
  for (const [tier, credentialCode] of fixtures) {
    const p = getBuklodAcademicCompletionPresentation({ ...valid, tier, credentialCode });
    assert.ok(p, tier);
    assert.ok(p.durationMs <= 2200, 'animation must be bounded');
    assert.ok(p.burstCount <= 13, 'particles must be bounded');
    names.add(p.name);
  }
  assert.equal(names.size, 4);
  assert.equal(Object.keys(BUKLOD_ACADEMIC_MOTION).length, 4);
});

test('respects persisted acknowledgement and requires valid issuance timestamp', () => {
  assert.equal(getBuklodAcademicCompletionPresentation(valid, new Set([valid.awardId])), null);
  assert.equal(getBuklodAcademicCompletionPresentation({ ...valid, issuedAt: 'unverified' }), null);
});
