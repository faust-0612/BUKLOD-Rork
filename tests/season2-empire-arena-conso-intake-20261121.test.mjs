import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const env=JSON.parse(read('eas.json')).build['season2-genesis-preview'].env;

test('The ONE BUKLOD Genesis map and Kingdom portal both reach the same in-app Arena',()=>{
 const map=JSON.parse(read('src/features/season2/genesis/genesisValleyHotspots.json'));
 const arena=map.hotspots.filter(x=>x.id==='kingdom-arena');
 assert.equal(arena.length,1);
 assert.equal(arena[0].route,'/games/empire-arena');
 const district=read('src/features/season2/genesis/genesisMapDistricts.ts');
 assert.match(district,/label: 'Empire Arena', route: '\/games\/empire-arena'/);
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 assert.match(portal,/router.push\('\/games\/empire-arena'/);
 const index=read('src/app/games/index.tsx');
 assert.match(index,/genesisPreview \? <GenesisKingdomPortal \/> : <BuklodKingdomMap \/>/);
 assert.match(index,/BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner"/);
 assert.ok(existsSync(resolve(root,'src/app/games/empire-arena.tsx')));
});

test('Direct link fails closed for production and unauthenticated, unconsented, forced-update and on-boarded clients',()=>{
 const route=read('src/app/games/empire-arena.tsx');
 for(const term of [
  'EmpireArenaRouteGuard','!isGenesisPreviewBuild()','!user',
  'requiresAcceptance','maintenance_mode','update_required',
  'pilot_access_required','!profile','onboarding','privacy/consent'
 ]) assert.ok(route.includes(term),'Missing Arena deep-link gate '+term);
 assert.match(route,/return <EmpireArenaInApp\/>/);
 assert.match(route,/OrientationLock\.LANDSCAPE/);
 assert.match(route,/OrientationLock\.DEFAULT/);
 assert.match(route,/useRorkGameAmbience/);
 assert.match(route,/arenaActorPose/);
});

test('Zero new staging projects: existing EAS package/channel and canonical paid Supabase are retained',()=>{
 const eas=JSON.parse(read('eas.json'));
 const preview=eas.build['season2-genesis-preview'];
 const original=eas.build['staging-user'];
 assert.equal(preview.extends,'staging-user');
 assert.equal(preview.channel,'season2-genesis-preview');
 assert.equal(preview.environment,'preview');
 assert.equal(preview.android.buildType,'apk');
 assert.equal(preview.env.EXPO_PUBLIC_SUPABASE_URL,'https://yhanxndaqbmuzbdqlblu.supabase.co');
 assert.match(preview.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,/^sb_publishable_/);
 assert.equal(original.channel,'staging-user');
 assert.equal(eas.build.production.channel,'production');
 assert.equal(env.EXPO_PUBLIC_BUKLOD_ARENA_EXPERIMENTAL,'true');
 assert.equal(env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED,'false');
 assert.equal(process.env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED==='true'&&env.EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED==='false',false);
});

test('No ranked Diamond stake until trusted existing paid-backend schema and WSS are deployed',()=>{
 const transport=read('src/features/games/empire/rankedClient.ts');
 const gateway=read('services/empire-arena/server.mjs');
 const screen=read('src/app/games/empire-arena.tsx');
 const sql=read('supabase/changesets/arena_v2_ranked_private_schema_DEV_ONLY.sql');
 assert.match(transport,/EXPO_PUBLIC_BUKLOD_ARENA_RANKED_ENABLED/);
 assert.match(transport,/EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW/);
 assert.match(transport,/EXPO_PUBLIC_APP_ENV/);
 assert.match(transport,/wss:/);
 assert.match(screen,/isArenaRankedConfigured\(\)/);
 assert.match(screen,/diamonds: 0, verifiedItems: \[\]/);
 assert.doesNotMatch(screen,/\.rpc\(|awardDiamond|awardBp|settleWorldTrade/);
 assert.match(gateway,/SupabaseArenaStore/);
 assert.match(sql,/arena/i);
});

test('All 13 original hero identities have fullbody motion on the same source-owned Arena baseline',()=>{
 const m=JSON.parse(read('assets/season2/arena/generated-manifest.json'));
 const reg=read('src/features/games/empire/arenaGeneratedAssets.ts');
 const poses=['idle','walk','attack','skill'];
 const heroes=['phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice'];
 const byKey=new Map(m.assets.map(x=>[x.key,x]));
 assert.equal(byKey.size,m.assets.length,'No duplicated registered image ownership');
 for(const hero of heroes){
  for(const pose of poses){
   const key='fullbody:'+hero+'_'+pose;
   const e=byKey.get(key);
   assert.ok(e,'Missing '+key);
   assert.ok(reg.includes("'"+key+"': require("),'Metro must statically register '+key);
   const buffer=readFileSync(resolve(root,e.file));
   assert.equal(buffer.length,e.bytes,key);
   assert.equal(createHash('sha256').update(buffer).digest('hex'),e.sha256,key);
  }
 }
 for(const scene of ['genesis_rift','aurora_foundry','verdant_fracture'])
  assert.ok(byKey.has('scene:'+scene));
});

test('Release remains HARD HOLD without signed matching Android APK and actual OTA provider receipt',()=>{
 const script=read('scripts/season2-premium-staging-ota-gate.mjs');
 assert.match(script,/Signed native APK EAS record evidence missing/);
 assert.match(script,/--source/);
 assert.match(script,/otaReady/);
 const map=read('src/app/buklod-map.tsx');
 assert.match(map,/BuklodFirstViewAd placement="home" placementId="new_home_first_view"/);
 const app=read('src/app/games/index.tsx');
 assert.match(app,/BuklodKingdomAdSlot/);
});
