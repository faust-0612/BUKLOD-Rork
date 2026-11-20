import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('new auth entry leads to guided Home with existing auth/compliance shell',()=>{
 const index=read('src/app/index.tsx');
 const tabs=read('src/app/(tabs)/_layout.tsx');
 assert.match(index,/href="\/\(tabs\)\/hub"/);
 assert.match(tabs,/initialRouteName: 'hub'/);
 for(const guard of ['if (!session)','requiresAcceptance','if (!profile)','config?.update_required'])
   assert.ok(tabs.includes(guard),guard);
});
test('Wall Connect and persistent Android navigation remain present',()=>{
 const tabs=read('src/components/BuklodAndroidDashboardTabs.tsx');
 for(const route of ['name="buklod"','name="hub"','name="messages"','name="me"'])
   assert.ok(tabs.includes(route),route);
 assert.match(tabs,/freezeOnBlur: true/);
});
test('new Home must not delay or delete first-view AdMob',()=>{
 const src=read('src/app/(tabs)/hub.tsx');
 assert.equal(src.split('placementId="new_home_first_view"').length-1,2);
 assert.equal(src.split('<BuklodWorldGateway />').length-1,2);
 const start=src.indexOf('<BuklodFirstViewAd placement="home"');
 const map=src.indexOf('<BuklodWorldGateway />');
 assert.ok(start>=0&&map>start);
});
test('all public/personal features and canonical Focus Apps stay discoverable',()=>{
 const source=read('src/features/world/worldCatalog.ts');
 const map=read('src/components/world/BuklodWorldGateway.tsx');
 assert.match(source,/BUKLOD_FEATURE_LINKS/);
 assert.match(source,/worldCompleteDestinationsByDistrict/);
 assert.match(map,/worldCompleteDestinationsByDistrict/);
 for(const route of ["/buklod","/messages","/clusters","/profile/focus-apps"])
   assert.ok(source.includes(route),route);
});
test('permanent World progression preserves 10 stages and complete house recipes',()=>{
 const tiers=read('src/features/world/worldDevelopmentCatalog.ts');
 const items=read('src/features/world/worldEconomyBlueprint.ts');
 assert.match(tiers,/MAX_LEVEL=10/);
 assert.match(tiers,/readonly \[string,string,string\]/);
 for(const name of ['starter-bungalow','family-residence','luxury-villa','grand-mansion'])
   assert.ok(items.includes("blueprint('"+name+"'"),name);
 assert.match(items,/WORLD_BP_PURCHASES_WITH_FIAT_ENABLED = false/);
 assert.match(items,/WORLD_TRADING_ENABLED = false/);
});
test('World BP cannot be bought and gifts never increase Lifetime Earned BP',()=>{
 const wallet=read('src/features/world/worldBpWalletContract.ts');
 assert.match(wallet,/WORLD_BP_SALES_ENABLED = false/);
 assert.match(wallet,/receivedEarnedOriginBp/);
 assert.match(wallet,/lifetimeEarnedBp/);
 assert.ok(!wallet.includes('purchasedAvailableBp'));
});
test('spend QMP disabled; only unused BP origin rights may qualify',()=>{
 const qmp=read('src/features/world/worldQmpPolicyDraft.ts');
 const lot=read('src/features/world/worldBpProvenance.ts');
 assert.match(qmp,/WORLD_QMP_ACTIVATION_ENABLED = false/);
 assert.match(qmp,/qmpEligibleBpDebited/);
 assert.match(qmp,/event.transactionKind!=='purchase'/);
 assert.match(lot,/recipientQmpEligibleBp=isGift\?spentEligible:0/);
});
test('member-progress community treasury is bounded and award settlement remains disabled',()=>{
 const t=read('src/features/world/worldCommunityTreasury.ts');
 const c=read('src/features/world/worldCommunityChallenges.ts');
 assert.match(t,/perCommunityMonthlyCapBp/);
 assert.match(t,/WORLD_COMMUNITY_AWARDS_ENABLED = false/);
 assert.match(c,/WORLD_WINNER_TAKES_STAKES_ENABLED = false/);
 assert.match(c,/recipientGetsOtherTeamsBudget!==false/);
});
test('community contests require independent evidence, not mutual approvals',()=>{
 const c=read('src/features/world/worldCommunityChallenges.ts');
 for(const marker of ['scopeIdsReviewerBelongsTo.some','verifiedWithIssuer','disputeOpen','independent_witness'])
   assert.ok(c.includes(marker),marker);
});
test('the world backend is not claimed deployed without isolated DB or art packs',()=>{
 const d=read('docs/BUKLOD_WORLD_BACKEND_MIGRATION_CONTRACT_20261121.md');
 assert.match(d,/NOT APPLIED TO ANY DATABASE/);
 assert.match(d,/Premium original/);
 const art=read('src/features/world/worldCustomization.ts');
 assert.match(art,/isWorldAssetApproved/);
});
