import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('PTT runtime state and existing navigation are preserved across native and web glass',()=>{
 for(const name of ['BuklodPttEntryButton.tsx','BuklodPttEntryButton.web.tsx']){
  const c=read('src/components/'+name);
  assert.match(c,/getBuklodPttRuntimeState/);
  assert.match(c,/subscribeBuklodPttRuntime/);
  assert.match(c,/router\.push\('\/personal-home\/ptt'/);
  assert.match(c,/!live && styles\.liveDotOff/);
  assert.match(c,/GENESIS \? <GenesisGlassDecoration/);
 }
});
test('Community economy, verified fund and private ranking stay server-authoritative',()=>{
 const q=read('src/components/BuklodCommunityContributionCard.tsx');
 const f=read('src/components/BuklodScopeFundCard.tsx');
 const rank=read('src/components/BuklodScopeBPTop10.tsx');
 assert.match(q,/loadMyCommunityContribution/);
 assert.match(q,/formatMinorPhp\(data\.estimated_share_minor\)/);
 assert.match(f,/get_buklod_scope_gcash_fund_dashboard_v1/);
 assert.match(f,/CANONICAL_FUNDED_COMMUNITY_LEDGER/);
 assert.match(f,/disabled=\{!fund\}/);
 assert.match(rank,/get_buklod_scope_bp_top10_v1/);
 assert.match(rank,/user\?\.id/);
});
test('Genesis glass is decoration and does not rework native ads',()=>{
 const v=read('src/features/season2/genesis/GenesisGlass.tsx');
 const home=read('src/app/(tabs)/hub.tsx');
 assert.match(v,/pointerEvents="none"/);
 assert.match(home,/<BuklodFirstViewAd placement="home"/);
});
