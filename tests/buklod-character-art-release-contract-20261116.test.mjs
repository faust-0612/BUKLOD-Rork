import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(p, 'utf8');
const contract = read('scripts/character-release-contract.mjs');
const visualPaths = [
  'src/components/points/BuklodProgressiveCharacterSelector.tsx',
  'src/components/points/BuklodSpecialCharacterSeries.tsx',
  'src/components/points/BuklodCharacterCustomizeSheet.tsx',
  'src/components/points/BuklodProgressiveCharacterArt.tsx'
];
test('owner-reviewed source identities remain exact, immutable, and enforced',()=>{
  for(const path of visualPaths){
    const sha=execFileSync('git',['rev-parse','HEAD:'+path],{encoding:'utf8'}).trim();
    assert.ok(contract.includes("'"+path+"': '"+sha+"'"),'Undeclared visual change: '+path);
  }
  assert.match(contract,/enforceExactVisualLock\(\)/);
});
test('special identity mask, persisted levels, fallback and remote art security',()=>{
  const special=read(visualPaths[1]);
  const core=read(visualPaths[0]);
  const item=read('src/components/points/BuklodCollectibleArt.tsx');
  const art=read('src/lib/buklodCollectibleArtwork.ts');
  assert.match(special,/visibleSpecialRail/);
  assert.match(special,/railIds\.map/);
  assert.match(special,/characterImageHidden/);
  assert.match(special,/NEXT SPECIAL/);
  assert.match(special,/state\.character_levels\[selected\.id\]/);
  assert.match(core,/state\.character_levels\[draft\]/);
  assert.match(core,/setMyBuklodCharacterActiveV2/);
  assert.match(item,/locked \|\| !uri \|\| failed/);
  assert.match(art,/export function collectibleArtworkUri/);
  assert.doesNotMatch(art,/SUPABASE_SERVICE_ROLE_KEY/i);
});
test('scope is limited to staged Character art and existing release gates',()=>{
  const scope=JSON.parse(read('.buklod/scopes/character-1300-art-motion-staging-20261116.json'));
  assert.equal(scope.contractVersion,2);
  assert.equal(scope.publicationStatus,'DEV_ONLY_NO_OTA');
  assert.equal(scope.releaseTarget,'staging-user Android runtime 1.3.2 only');
  for(const path of scope.allowedPaths) {
    assert.doesNotMatch(path,/^src\/providers\/AdsProvider|^supabase\/migrations|^src\/app\/connect\//);
  }
});
