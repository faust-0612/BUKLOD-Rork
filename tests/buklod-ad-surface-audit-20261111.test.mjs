import test from 'node:test';
import assert from 'node:assert/strict';
import { auditBuklodAdSurfaces } from '../scripts/buklod-ad-surface-audit.mjs';

const result = auditBuklodAdSurfaces();
const get = route => result.routes.find(row => row.route === route);

test('Coverage audit traverses the entire Main route tree, not a hard-coded surface list', () => {
  assert.ok(result.summary.routeFiles >= 300,
    'Unexpectedly small Main route inventory: ' + result.summary.routeFiles);
  assert.ok(result.summary.withPressHandlers > 100);
  assert.ok(result.summary.reviewVerifiedSuccessBreak > 0,
    'Audit should reveal unreviewed mutation routes, not silently call everything covered');
  assert.equal(result.routes.length, result.summary.routeFiles);
});

test('Protected workflows are never blanket interstitial candidates', () => {
  for(const name of [
    'admin/index.tsx','profile/buklod-classroom-grades.tsx','bayanihan/payout-profile.tsx',
    'prayer/new.tsx','profile/buklod-health.tsx'
  ]) {
    const route=get(name);
    if (!route) continue;
    assert.equal(route.recommendation, 'NO_GENERIC_INTERSTITIAL', name);
  }
});

test('New eligible creation/progression screens remain in the audit', () => {
  for(const name of [
    'games/index.tsx','igpat/create.tsx','points/economy.tsx',
    'points/progression.tsx','profile/status.tsx','mentoring/index.tsx'
  ]) assert.ok(get(name), 'Missing route: '+name);
});

test('Inventory is descriptive and does not synthesize AdMob loads or impressions', () => {
  const source=String(auditBuklodAdSurfaces);
  assert.doesNotMatch(source, /(?:InterstitialAd\.createForAdRequest|NativeAd\.createForAdRequest|ad\.show\()/);
});

test('Entire app inventory classifies active personal chat and sensitive admin operations', () => {
  for (const [route, expected] of [
    ['connect/personal/[threadId].tsx','live-conversation'],
    ['mzb/connect/personal/[threadId].tsx','live-conversation'],
    ['organizations/manage.tsx','sensitive-operation'],
    ['scope/manage/index.tsx','sensitive-operation'],
  ]) {
    const row=get(route);
    assert.ok(row, 'Missing route '+route);
    assert.equal(row.category,expected,route);
    assert.equal(row.recommendation,'NO_GENERIC_INTERSTITIAL',route);
  }
  assert.equal(Object.values(result.summary.categoryCounts).reduce((a,b)=>a+b,0),result.summary.routeFiles);
});
