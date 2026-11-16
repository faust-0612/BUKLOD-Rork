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

test('personal Home launcher moves to Family with the original household route', () => {
  const family=fs.readFileSync('src/app/profile/buklod-family.tsx','utf8');
  assert.ok(family.includes('My BUKLOD Home') && family.includes("router.push('/personal-home'"));
  assert.ok(family.includes("colors={['#102D41', '#115A58', '#168A70']}"));
  assert.ok(!cards.includes('My BUKLOD Home') && !cards.includes('Online Consultation'));
});

test('Health Center stays under Health while Home ads, map, Today, SOS and QMP remain', () => {
  const health=fs.readFileSync('src/app/profile/buklod-health.tsx','utf8');
  assert.ok(health.includes('launchBuklodHealthCenter') && health.includes('Online Consultation') && health.includes('Full Health Center'));
  for (const preserved of ['<Contribution />','<BuklodFirstViewAd','<BuklodNativeSponsoredCard','<PttCard />','<Today />','<Map />','<Help />']) {
    assert.ok(hub.includes(preserved), 'Missing Home feature: '+preserved);
  }
  assert.ok(!hub.includes('BuklodKingdomHubCard'));
});
