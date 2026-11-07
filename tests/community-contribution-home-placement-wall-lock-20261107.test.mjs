import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const home = read('src/app/(tabs)/home.tsx');
const wall = read('src/app/(tabs)/buklod.tsx');
const card = read('src/components/BuklodCommunityContributionCard.tsx');

test('Community Contribution renders on Home exactly once and is absent from Public Wall', () => {
  assert.match(home, /import BuklodCommunityContributionCard from '@\/components\/BuklodCommunityContributionCard'/);
  assert.equal((home.match(/<BuklodCommunityContributionCard\s*\/>/g) || []).length, 1);
  assert.doesNotMatch(wall, /<BuklodCommunityContributionCard\s*\/>/);
  assert.doesNotMatch(wall, /import BuklodCommunityContributionCard/);
});

test('Home positions card below the existing bulletins and before Top 10; no screen rearrangement', () => {
  const bulletins = home.indexOf('<BuklodHomeScopeBulletins />');
  const contribution = home.indexOf('<BuklodCommunityContributionCard />');
  const topTen = home.indexOf('TOP 10 MEMBERS');
  assert.ok(bulletins >= 0 && contribution > bulletins && topTen > contribution);
  assert.match(home, /<BuklodSystemAnnouncementBoard slot="public_home"\s*\/>/);
  assert.match(home, /<BuklodScreenBottomBanner placement="home" variant="large"\s*\/>/);
});

test('approved Community Wall composer, Marites, location tabs and media path stay intact', () => {
  for (const anchor of [
    '<BuklodLifeWallCard />',
    '<KabihasnangLigawWallCard />',
    '<BuklodMaritesBoard',
    '<BuklodPublicLocationChips',
    'Encourage, connect and grow together.',
    'Share with your Community...',
    'wallComposerTone.surface',
  ]) assert.ok(wall.includes(anchor), 'Missing locked Wall anchor: ' + anchor);
  assert.match(wall, /BuklodCommunityPhotoCollage/);
  assert.match(wall, /CommunityVideo/);
});

test('card financial privacy, monthly/lifetime separation, noncash guidance and navigation stay unchanged', () => {
  for (const anchor of [
    'YOUR COMMUNITY CONTRIBUTION',
    'THIS MONTH QMP',
    'SHARE WEIGHT',
    'QUALIFIED CONTENT',
    'Lifetime QMP:',
    'ESTIMATED REVENUE SHARE',
    'No safe estimate yet',
    'NOT WITHDRAWABLE',
    'HOW CAN I INCREASE MY SHARE?',
    "router.push('/community-contribution?guide=1'",
  ]) assert.ok(card.includes(anchor), 'Missing preserved contribution-card contract: ' + anchor);
  assert.match(card, /setData\(null\); \/\/ Never reuse another account's financial preview/);
  assert.match(card, /loadMyCommunityContribution\(\)/);
  assert.match(card, /loadMyCommunityQmpHistory\(\)/);
});
