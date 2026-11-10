import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');

test('Kingdom ads stay out of live gameplay and quiz answer buttons', () => {
  const policy=read('src/lib/buklodGlobalAdController.ts');
  assert.match(policy, /placementId\.startsWith\('kingdom_'\)/);
  assert.match(policy, /kingdom_game_center_completed/);
  assert.match(policy, /interstitial_kingdom_mastery_verified/);
  assert.match(policy, /Math\.max\(2, INTERSTITIAL_MIN_EVENT_COUNT\)/);
  assert.match(policy, /fullScreenCadencePersistenceFailed/);
});

test('All major Kingdom and Points read surfaces use Android-only viewable inventory', () => {
  for(const [p,needle] of [
    ['src/app/games/index.tsx','kingdom_map_footer'],
    ['src/features/games/kingdom/platform/KingdomInteriorCenter.tsx','kingdom_game_center_completed'],
    ['src/app/points/progression.tsx','points_rank_progression_native'],
    ['src/app/points/economy.tsx','points_economy_footer'],
    ['src/components/points/BuklodPointsRewardsScreen.tsx','points_redeem_transition_native']
  ]) assert.ok(read(p).includes(needle),p+' lost inventory');
  assert.match(read('src/components/BuklodKingdomAdSlot.tsx'), /Platform\.OS !== 'android'/);
});

test('Character Studio full-screen opportunity only follows real saved changes and dismissal', () => {
  const s=read('src/components/points/BuklodProfileCharacterCard.tsx');
  assert.match(s, /characterSavedSinceOpen\.current = true/);
  assert.match(s, /if \(customizeOpen \|\| !characterSavedSinceOpen\.current\) return/);
  assert.match(s, /showBuklodAdOpportunity\('character_studio_saved'\)/);
  assert.match(s, /onClose=\{closeCharacterStudio\}/);
});

test('Kingdom mastery advertising is conditional on server verification', () => {
  const s=read('src/features/games/kingdom/platform/KingdomMasteryCheck.tsx');
  assert.match(s, /if \(result\?\.verified\)/);
  assert.match(s, /result\.points_awarded/);
  assert.match(s, /showBuklodAdOpportunity\('kingdom_mastery_verified'\)/);
});

test('IGPAT publishing and mentoring submission ads are scoped to completed workflows', () => {
  const gate=read('src/lib/buklodGlobalAdController.ts');
  const reel=read('src/app/igpat/create.tsx');
  const mentoring=read('src/app/mentoring/index.tsx');
  assert.match(gate, /interstitial_igpat_video_published/);
  assert.match(reel, /if \(error\) throw error;[\s\S]*showBuklodAdOpportunity\('igpat_video_published'\)/);
  assert.match(mentoring, /'Mentoring Submitted'[\s\S]*onPress: \(\) => \{ void showBuklodAdOpportunity/);
});

test('Route-sensitive Kingdom native inventory preserves the exact placement override',()=>{
 const component=read('src/components/BuklodKingdomAdSlot.tsx');
 assert.match(component,/placementIdOverride=\{placementId\}/);
});
