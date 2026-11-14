import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const hub = fs.readFileSync('src/app/(tabs)/hub.tsx', 'utf8');
const cards = fs.readFileSync('src/components/home/BuklodHomeUtilityCards.tsx', 'utf8');
const merged = fs.readFileSync('src/components/home/BuklodHomeMergedUpdates.tsx', 'utf8');

test('owner-retired bulletin drawer is absent in mobile and desktop Home', () => {
  for (const stale of ['updatesOpen', 'setUpdatesOpen', 'Open Updates & Bulletins', 'Hide Updates & Bulletins', 'Announcements & Bulletins', '<Updates />', "const Updates = lazy("]) {
    assert.ok(!hub.includes(stale), `Home drawer reintroduced: ${stale}`);
  }
  assert.equal(hub.split('<BuklodSystemAnnouncementBoard slot="public_home" />').length - 1, 2,
    'desktop and mobile must retain visible important public announcements');
  assert.match(merged, /<BuklodHomeScopeBulletins \/>/, 'original bulletin component is not deleted or modified');
});

test('new compact personal Home launcher is real and routes to existing household app', () => {
  assert.match(cards, /<LinearGradient[\s\S]*colors=\{\['#102D41', '#115A58', '#168A70'\]\}/);
  assert.match(cards, /name="home-heart"/);
  assert.match(cards, /accessibilityLabel="Open My BUKLOD Home"/);
  assert.match(cards, /router\.push\('\/personal-home' as any\)/);
  assert.ok(!cards.includes('miniHouse') && !cards.includes('s.homeCard'), 'outdated miniature floorplan retired');
  assert.match(cards, /fontScale >= 1\.5 \|\| width < 370/, 'stacked layout must protect system font scale');
});

test('Home health doors, ads, map, SOS and QMP remain mounted and wired', () => {
  assert.match(cards, /router\.push\('\/profile\/buklod-health' as any\)/);
  assert.match(cards, /launchBuklodHealthCenter/);
  assert.match(cards, /Online Consultation/);
  assert.match(cards, /Full Health Center/);
  for (const preserved of ['<Contribution />', '<BuklodFirstViewAd', '<BuklodNativeSponsoredCard', '<PttCard />', '<Today />', '<Map />', '<Help />', '<BuklodKingdomHubCard />']) {
    assert.ok(hub.includes(preserved), `Missing Home feature: ${preserved}`);
  }
});
