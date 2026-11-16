import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync(new URL('../src/app/(tabs)/me.tsx', import.meta.url), 'utf8');

test('Compact Profile action tiles retain their original destinations and identity boundary', () => {
  assert.match(profile, /\['Edit Profile', '\/account\/personal-information', 'pencil-outline'\]/);
  assert.match(profile, /\['My Note', '\/profile\/status', 'text-box-edit-outline'\]/);
  assert.match(profile, /onPress=\{\(\) => router\.push\(path as any\)\}/);
  assert.match(profile, /onPress=\{\(\) => \{ void shareMyProfile\(\); \}\}/);
  assert.match(profile, /if\(!profile\?\.id \|\| profileLocked\)/);
  assert.match(profile, /role !== 'member'/);
  assert.match(profile, /isBuklodOfficial && role === 'system_admin'/);
});

test('Canonical Profile tab navigation, personal content, and visibility settings remain', () => {
  for (const token of [
    "router.push('/points' as any)", "router.push('/points/progression' as any)",
    "router.push('/profile/attendance-qr' as any)",
    '<BuklodProfileMembershipNav />', '<BuklodProfilePostCards userId={profile.id} />',
    '<BuklodProfileTopTenRankings userId={profile.id} />',
    'loadMyProfileLocked()', 'setMyProfileLocked(next)', 'profileLocked',
  ]) assert.ok(profile.includes(token), 'Missing Profile navigation/privacy contract: ' + token);
});
