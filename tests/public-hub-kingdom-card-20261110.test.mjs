import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const hub = fs.readFileSync('src/app/(tabs)/hub.tsx', 'utf8');
const card = fs.readFileSync('src/components/home/BuklodKingdomHubCard.tsx', 'utf8');
const gameEntry = fs.readFileSync('src/app/games/index.tsx', 'utf8');

test('Kingdom remains in hamburger menu without duplicate Home card', () => {
  assert.ok(!hub.includes('BuklodKingdomHubCard'));
  const menu=fs.readFileSync('src/components/BuklodNavigationSideMenu.tsx','utf8');
  assert.ok(menu.includes('BUKLOD Kingdom') && menu.includes("route: '/games'"));
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
