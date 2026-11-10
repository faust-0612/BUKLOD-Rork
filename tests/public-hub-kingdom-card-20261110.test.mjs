import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const hub = fs.readFileSync('src/app/(tabs)/hub.tsx', 'utf8');
const card = fs.readFileSync('src/components/home/BuklodKingdomHubCard.tsx', 'utf8');
const gameEntry = fs.readFileSync('src/app/games/index.tsx', 'utf8');

test('Kingdom invitation is last on both public Hub render variants', () => {
  const markers = [...hub.matchAll(/<BuklodKingdomHubCard \/>/g)];
  assert.equal(markers.length, 2, 'desktop and mobile each render exactly one card');
  const desktop = hub.slice(hub.indexOf('if (desktopDashboard) {'), hub.indexOf('  return (\n    <ScrollView style='));
  const mobile = hub.slice(hub.indexOf('  return (\n    <ScrollView style='));
  assert.match(desktop, /<BuklodFirstViewAd placement="home" placementId="new_home_first_view" \/>\s*<BuklodKingdomHubCard \/>\s*<\/ScrollView>/);
  assert.match(mobile, /Return to Community Wall<\/Text>[\s\S]*<\/Pressable>\s*<BuklodKingdomHubCard \/>\s*<\/ScrollView>/);
});

test('Kingdom card is accessible and opens existing premium map, not a duplicate game', () => {
  assert.match(card, /accessibilityRole="button"/);
  assert.match(card, /accessibilityLabel="Buksan ang BUKLOD Kingdom"/);
  assert.match(card, /router\.push\('\/games' as any\)/);
  assert.match(card, /<LinearGradient/);
  assert.match(card, /13 CHARACTER CENTERS/);
  assert.match(gameEntry, /BuklodKingdomMapPremium/);
  assert.doesNotMatch(card, /supabase|grant.*points|claim.*reward|Math\.random/);
});
