import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const connect = read('src/app/(tabs)/messages.tsx');
const profile = read('src/app/(tabs)/me.tsx');
const character = read('src/components/points/BuklodProfileCharacterCard.tsx');

test('Connect and Profile navigation remains available after geometry changes', () => {
  for (const token of ['<ConnectInboxTabs', 'onTabChange={setTab}',
    'onCommunityFilterChange={setCommunityFilter}', 'openSuggestedContact',
    'openPersonalThread', 'openCommunityRoom', 'ConnectInboxSearch']) {
    assert.ok(connect.includes(token), token);
  }
  assert.ok(profile.includes('MY OVERALL & MONTHLY RANK'));
  assert.ok(profile.includes('<BuklodProfileCharacterCard'));
  assert.ok(profile.includes('<BuklodProfileTopTenRankings userId={profile.id} />'));
  assert.ok(profile.includes('<ProfileMotionAvatar>'));
});

test('Character studio, rank progression, Point claims and approved ads are preserved', () => {
  for (const token of ['loadBuklodClaimGroups', 'BuklodActiveCharacterArt',
    'BuklodCharacterCustomizeSheet', 'BuklodCircleRankBadge',
    'BuklodAdLightRewardCard', 'showBuklodAdOpportunity',
    'useFocusEffect(', 'router.push(\'/points/progression\' as any)']) {
    assert.ok(character.includes(token), token);
  }
  assert.ok(!character.includes('get_buklod_points_leaderboard'));
  assert.ok(profile.includes('<BuklodNativeSponsoredCard'));
  assert.ok(profile.includes('<BuklodFirstViewAd'));
});
