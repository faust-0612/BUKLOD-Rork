import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

const read = p => readFileSync(p, 'utf8');
const source = read('src/lib/buklodHealthCenterLauncher.ts');
const js = stripTypeScriptTypes(source).replace(/^export /gm, '');
const doors = runInNewContext(js + '\n({ launchBuklodHealthCenter, launchBuklodHealthConsultation, launchBuklodHealthProfessionals, BUKLOD_HEALTH_CENTER_URL, BUKLOD_HEALTH_CONSULTATION_URL, BUKLOD_HEALTH_PROFESSIONALS_URL })', {process:{env:{}}});

test('Three Health Center doors use fixed same-origin HTTPS paths with no credentials or health data', async () => {
  const paths = [];
  for (const fn of [doors.launchBuklodHealthCenter, doors.launchBuklodHealthConsultation, doors.launchBuklodHealthProfessionals]) {
    await fn(async url => { paths.push(url); });
  }
  assert.deepEqual(paths, [
    'https://buklod-health-center.vercel.app/',
    'https://buklod-health-center.vercel.app/consult',
    'https://buklod-health-center.vercel.app/consult/professionals',
  ]);
  for (const path of paths) {
    const url = new URL(path);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.origin, 'https://buklod-health-center.vercel.app');
    assert.equal(url.search, '');
    assert.equal(url.hash, '');
    assert.equal(url.username, '');
    assert.equal(url.password, '');
  }
  assert.doesNotMatch(source, /access_token|refresh_token|session=|user_id=|symptom=|concern=/);
});

test('Home square Health card has distinct online consultation and full standalone doors', () => {
  const home = read('src/components/home/BuklodHomeUtilityCards.tsx');
  const hub = read('src/app/(tabs)/hub.tsx');
  assert.match(home, /id:'health'/);
  assert.match(home, /Online Consultation/);
  assert.match(home, /Full Health Center/);
  assert.match(home, /router\.push\('\/profile\/buklod-health'/);
  assert.match(home, /launchBuklodHealthCenter/);
  assert.match(home, /aspectRatio: 1/);
  assert.equal(hub.split('<BuklodHomeUtilityCards />').length-1, 2);
  assert.doesNotMatch(home, /getUser\(|supabase\.auth|getSession\(/);
});

test('Online consultation is gated by explicit urgent check; urgent mode has emergency guidance and no ad', () => {
  const portal = read('src/app/profile/buklod-health.tsx');
  assert.match(portal, /useState<Urgency>\('unanswered'\)/);
  assert.match(portal, /urgency === 'none'/);
  assert.match(portal, /urgency !== 'none' \|\| !BUKLOD_HEALTH_CONSULTATION_READY \|\| opening !== null/);
  assert.match(portal, /if \(door === 'standalone'\)/);
  assert.match(portal, /else if \(urgency === 'none' && BUKLOD_HEALTH_CONSULTATION_READY\)/);
  assert.match(portal, /Call 911 \(PH\)/);
  assert.match(portal, /!urgent \? \(/);
  assert.match(portal, /launchBuklodHealthConsultation/);
  assert.doesNotMatch(portal, /AsyncStorage|supabase\.from|supabase\.auth|fetch\(/);
});

test('Only one ad placement exists for Health screen, after nonurgent screening', () => {
  const portal = read('src/app/profile/buklod-health.tsx');
  const strip = read('src/components/BuklodFocusAppAdStrip.tsx');
  const healthLines = strip.split('\n').filter(line => line.trim().startsWith("'/profile/buklod-health'"));
  assert.equal(healthLines.length, 0, 'no duplicate global focus banner for Health');
  assert.match(portal, /urgency === 'none' \? \([\s\S]*?<BuklodAdMobBanner/);
  assert.match(portal, /placement="focus"/);
  assert.match(portal, /requireViewport/);
  assert.match(portal, /showLabel/);
  assert.doesNotMatch(portal, /showBuklodInterstitial|showBuklodRewarded|setTimeout\(/);
});

test('Patient door still bypasses Health Worker gate only, not privileged health roles', () => {
  const guard = read('src/components/BuklodFocusAppRouteGuard.tsx');
  assert.match(guard, /pathname === '\/profile\/buklod-health'/);
  assert.ok(guard.indexOf("pathname === '/profile/buklod-health'") < guard.indexOf('focusAppForPathname(pathname)'));
  assert.match(guard, /verifyFocusApp\(app\)/);
});

test('No AI or professional browser handoff before HC standalone backend activation', () => {
  const portal = read('src/app/profile/buklod-health.tsx');
  assert.match(source, /EXPO_PUBLIC_HEALTH_CONSULTATION_ENABLED/);
  assert.match(source, /EXPO_PUBLIC_HEALTH_PROFESSIONAL_PORTAL_ENABLED/);
  assert.match(portal, /!BUKLOD_HEALTH_CONSULTATION_READY/);
  assert.match(portal, /!BUKLOD_HEALTH_PROFESSIONALS_READY/);
  assert.match(portal, /AI Health Guide activation pending/);
  assert.match(portal, /Contributor registration pending/);
});
