import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync(new URL('../src/app/(tabs)/me.tsx', import.meta.url), 'utf8');

test('Profile hero uses a prominent single-line name and meaningful canonical rank', () => {
  assert.match(profile, /testID="profile-primary-display-name"[\s\S]*?numberOfLines=\{1\}[\s\S]*?adjustsFontSizeToFit/);
  assert.match(profile, /fontSize: 25,[\s\S]*?lineHeight: 31/);
  assert.match(profile, /testID="profile-identity-rank"/);
  assert.match(profile, /Circle Rank: \$\{circleRank\}/);
  assert.match(profile, /All-time Rank #\$\{rankPositions\.overall\}/);
  assert.doesNotMatch(profile, /Tap photo to change/);
  assert.match(profile, /role !== 'member'/);
});

test('Extended cover and compact actions preserve photo and account controls', () => {
  assert.match(profile, /paddingTop: coverUrl \? 195 : 56/);
  assert.match(profile, /height: 256, overflow: 'hidden'/);
  assert.match(profile, /profilePrimaryActions: \{ flexDirection: 'row', flexWrap: 'wrap'/);
  assert.match(profile, /profilePrimaryActionLargeText: \{ flexBasis: '46%'/);
  for (const control of ['Edit Profile', 'My Note', 'Share my public profile information', 'changeProfilePhoto();', 'changeProfileBackground();', '{profileNote}']) {
    assert.ok(profile.includes(control), 'Missing preserved profile control: ' + control);
  }
  assert.match(profile, /if\(!profile\?\.id \|\| profileLocked\)/);
});

test('Rank cards, member content and monetization remain outside header', () => {
  for (const token of ['MY OVERALL & MONTHLY RANK', "['ALL-TIME',rankPositions?.overall]", "['MONTHLY',rankPositions?.monthly]",
    '<BuklodProfileCharacterCard', '<BuklodProfilePostCards userId={profile.id} />',
    '<BuklodProfileTopTenRankings userId={profile.id} />', 'BuklodNativeSponsoredCard',
    'BuklodFirstViewAd', 'BuklodScreenBottomBanner']) {
    assert.ok(profile.includes(token), 'Missing regression guard: ' + token);
  }
});
