import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const names=['BuklodTodayCard.tsx','SmartDrawerWallCard.tsx','BuklodCommunityContributionCard.tsx',
 'BuklodScopeFundCard.tsx','BuklodScopeBPTop10.tsx','BuklodScopeProfilePhoto.tsx',
 'BuklodPttEntryButton.tsx','BuklodPttEntryButton.web.tsx'];
test('Genesis glass is restricted to nonproduction seasonal preview',()=>{
 for(const name of names){const source=read('src/components/'+name);
  assert.match(source,/isGenesisPreviewBuild\(\)/);
  assert.match(source,/GENESIS\s*\?/);
  assert.match(source,/GenesisGlassDecoration/);
 }
 assert.match(read('src/features/season2/genesis/genesisContract.ts'),/enabled==='true'&&\['staging','preview','development','dev'\]/);
});
test('Galaxy decoration is local, noninteractive and static',()=>{
 const glass=read('src/features/season2/genesis/GenesisGlass.tsx');
 assert.match(glass,/GENESIS_GALAXY_IMAGES\[scene\]/);
 assert.match(glass,/pointerEvents="none"/);
 assert.match(glass,/opacity:0\.17/);
 assert.doesNotMatch(glass,/fetch\(|https?:\/\//);
});
test('Fund, ranking and contribution RPC and source guards are preserved',()=>{
 assert.match(read('src/components/BuklodScopeFundCard.tsx'),/get_buklod_scope_gcash_fund_dashboard_v1/);
 assert.match(read('src/components/BuklodScopeFundCard.tsx'),/CANONICAL_FUNDED_COMMUNITY_LEDGER/);
 assert.match(read('src/components/BuklodScopeBPTop10.tsx'),/get_buklod_scope_bp_top10_v1/);
 assert.match(read('src/components/BuklodCommunityContributionCard.tsx'),/estimated_share_minor/);
 assert.match(read('src/app/(tabs)/hub.tsx'),/<BuklodFirstViewAd placement="home"/);
});
