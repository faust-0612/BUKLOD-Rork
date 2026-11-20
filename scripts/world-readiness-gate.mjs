/**
 * No-credits, no-network World source contract gate.
 * Run: npm run world:readiness
 * Safe for DEV; production requires separate real DB/assets/QA evidence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(filename)=>fs.readFileSync(path.join(root,filename),'utf8');
const exists=(filename)=>fs.existsSync(path.join(root,filename));
const failures=[];
const checks=[];
function expectRule(name,check){
 let ok=false;
 try{ok=Boolean(check());}catch(error){failures.push(name+': '+String(error));return;}
 if(!ok)failures.push(name);
 else checks.push(name);
}
const home=read('src/app/(tabs)/hub.tsx');
const rootEntry=read('src/app/index.tsx');
const tabs=read('src/app/(tabs)/_layout.tsx');
const androidTabs=read('src/components/BuklodAndroidDashboardTabs.tsx');
const catalog=read('src/features/world/worldCatalog.ts');
const gateway=read('src/components/world/BuklodWorldGateway.tsx');
const wallet=read('src/features/world/worldBpWalletContract.ts');
const provenance=read('src/features/world/worldBpProvenance.ts');
const qmp=read('src/features/world/worldQmpPolicyDraft.ts');
const treasury=read('src/features/world/worldCommunityTreasury.ts');
const challenges=read('src/features/world/worldCommunityChallenges.ts');
const graphics=read('src/features/world/worldCustomization.ts');
const tiers=read('src/features/world/worldDevelopmentCatalog.ts');
const prices=read('src/features/world/worldEconomyBlueprint.ts');
const build=read('src/features/world/worldBuildPlanning.ts');
const progression=read('src/features/world/worldProgression.ts');
const blueprint=read('docs/BUKLOD_WORLD_OVERALL_RECONSTRUCTION_BLUEPRINT_20261120.md');
const backend=read('docs/BUKLOD_WORLD_BACKEND_MIGRATION_CONTRACT_20261121.md');
const firstViewAd='<BuklodFirstViewAd placement="home" placementId="new_home_first_view" />';
const mapTag='<BuklodWorldGateway />';
expectRule('Home entry remains purpose-first, auth checks preserved',()=>rootEntry.includes('href="/(tabs)/hub"')&&tabs.includes("initialRouteName: 'hub'")&&tabs.includes('requiresAcceptance'));
expectRule('Android permanent tabs preserve main functions',()=>['name="buklod"','name="hub"','name="messages"','name="me"'].every(x=>androidTabs.includes(x))&&tabs.includes('BuklodAndroidDashboardTabs'));
expectRule('Home first-view ads are present before map in both render variants',()=>{
 const ads=home.split(firstViewAd).length-1;
 const maps=home.split(mapTag).length-1;
 return ads===2&&maps===2;
});
expectRule('Existing Wall/Connect/Cluster/Focus Apps remain available',()=>['route:\'/buklod\'','route:\'/messages\'','route:\'/clusters\'','route:\'/profile/focus-apps\''].every(x=>catalog.includes(x)));
expectRule('Full existing feature search directory is preserved',()=>catalog.includes('BUKLOD_FEATURE_LINKS')&&gateway.includes('worldCompleteDestinationsByDistrict'));
expectRule('Incomplete World areas are explicitly labeled preview-only',()=>catalog.includes("route:null,state:'preview'")&&gateway.includes('Under development'));
expectRule('No BP fiat top-ups or World trades enabled',()=>wallet.includes('WORLD_BP_SALES_ENABLED = false')&&prices.includes('WORLD_BP_PURCHASES_WITH_FIAT_ENABLED = false')&&prices.includes('WORLD_TRADING_ENABLED = false'));
expectRule('Received BP cannot automatically become earned BP/rank',()=>wallet.includes('receivedEarnedOriginBp')&&wallet.includes('lifetimeEarnedBp')&&wallet.includes('receive_transfer'));
expectRule('BP transfer and QMP spend provenance guarded',()=>provenance.includes('WORLD_BP_PROVENANCE_SETTLEMENT_ENABLED = false')&&provenance.includes('recipientQmpEligibleBp=isGift?spentEligible:0')&&qmp.includes('qmpEligibleBpDebited'));
expectRule('QMP remains disabled, only eligible BP purchases qualify',()=>qmp.includes('WORLD_QMP_ACTIVATION_ENABLED = false')&&qmp.includes("event.transactionKind!=='purchase'")&&qmp.includes('event.purchasedBpDebited!==0'));
expectRule('Cluster treasury issuances and awards are disabled pending backend validation',()=>treasury.includes('WORLD_COMMUNITY_TREASURY_ENABLED = false')&&treasury.includes('WORLD_COMMUNITY_AWARDS_ENABLED = false')&&treasury.includes('perCommunityMonthlyCapBp'));
expectRule('Community contest winnings cannot take losing member stakes',()=>challenges.includes('WORLD_WINNER_TAKES_STAKES_ENABLED = false')&&challenges.includes("cluster_treasury_award")&&challenges.includes('recipientGetsOtherTeamsBudget!==false'));
expectRule('Real world projects require neutral audit, issuer verification and dispute gate',()=>challenges.includes('independent_witness')&&challenges.includes('verifiedWithIssuer')&&challenges.includes('disputeOpen'));
expectRule('Ten permanent property tiers and three construction substeps are defined',()=>tiers.includes('WORLD_DEVELOPMENT_ENABLED = false')&&tiers.includes('const MAX_LEVEL=10')&&tiers.includes('readonly [string,string,string]'));
expectRule('All four house tiers have material recipes',()=>['starter-bungalow','family-residence','luxury-villa','grand-mansion'].every(x=>prices.includes("blueprint('"+x+"'"))&&build.includes('recipe.length===0'));
expectRule('Catalog supports per kg/liter/pc and bundles',()=>prices.includes("type WorldUnit=")&&prices.includes("unit:'kg'")&&prices.includes("unit:'liter'")&&prices.includes('bundleCount'));
expectRule('World progression cannot claim an unverified scene',()=>progression.includes('authoritative_server')&&progression.includes('assetApproved')&&progression.includes('receiptId'));
expectRule('Premium asset release requires license, hash and layered scene metadata',()=>graphics.includes('isWorldAssetApproved')&&graphics.includes("layerKind:'base'")&&graphics.includes("quality:'premium'"));
expectRule('Canonical backend and full blueprint docs exist',()=>blueprint.includes('### E6. Cluster BP Treasury')&&backend.includes('buklod_points_ledger')&&backend.includes('challenge_award_reservations'));
expectRule('New world contract tests exist',()=>[
 '__tests__/worldBpWalletContract.test.ts','__tests__/worldBpProvenance.test.ts',
 '__tests__/worldCommunityTreasury.test.ts','__tests__/worldCommunityChallenges.test.ts',
 '__tests__/worldCustomization.test.ts','__tests__/worldItemCatalog.test.ts',
 '__tests__/worldDevelopmentBuildPlanning.test.ts','__tests__/worldCatalog.test.ts',
 '__tests__/worldQmpPolicyDraft.test.ts',
].every(exists));
for(const name of checks)console.log('PASS '+name);
for(const name of failures)console.error('FAIL '+name);
if(failures.length){
 console.error('WORLD SOURCE CONTRACT FAILED: '+failures.length+' checks.');
 process.exitCode=1;
}else{
 console.log('WORLD SOURCE CONTRACT PASSED: '+checks.length+' checks.');
 console.log('NOTE: Source readiness does not certify premium assets, migration, Android rendering, CI, or production rollout.');
}
if(process.env.WORLD_REQUIRE_PRODUCTION_READY==='1'){
 console.error('FAIL: World production release remains blocked until DB, art and device gates are proven.');
 process.exitCode=1;
}
