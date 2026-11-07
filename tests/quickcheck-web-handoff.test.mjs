import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/components/BuklodFoundationWorkspaceNav.tsx', import.meta.url), 'utf8');
const quickCheckStart = source.indexOf("if (app.key === 'quick-check') {");
const quickCheckEnd = source.indexOf("if (app.key === 'quiz') {", quickCheckStart);
const launch = source.slice(quickCheckStart, quickCheckEnd);

test('QuickCheck mints a server-authorized one-time launch URL before redirect', () => {
  assert.ok(quickCheckStart >= 0);
  assert.match(launch, /supabase\.functions\.invoke\(\s*'quickcheck-handoff-mint'/);
  assert.match(launch, /if \(error\) throw error/);
  assert.match(launch, /data\?\.url/);
});

test('web uses same-tab navigation to avoid post-await popup blocking', () => {
  assert.match(launch, /Platform\.OS === 'web'/);
  assert.match(launch, /location\.assign\(destination\.href\)/);
  assert.ok(!launch.includes('window.open('));
  assert.ok(launch.indexOf('location.assign(destination.href)') > launch.indexOf("if (error) throw error"));
});

test('web handoff target is HTTPS, canonical QuickCheck host, and requires code', () => {
  assert.match(launch, /destination\.protocol !== 'https:'/);
  assert.match(launch, /destination\.hostname !== 'buklod-quickcheck-web\.vercel\.app'/);
  assert.match(launch, /!destination\.searchParams\.get\('handoff'\)/);
});

test('native QuickCheck still uses supported Linking launch after web branch', () => {
  assert.match(launch, /Linking\.canOpenURL\(url\)/);
  assert.match(launch, /await Linking\.openURL\(url\)/);
  assert.ok(launch.indexOf("if (Platform.OS === 'web')") < launch.indexOf('Linking.canOpenURL(url)'));
});
