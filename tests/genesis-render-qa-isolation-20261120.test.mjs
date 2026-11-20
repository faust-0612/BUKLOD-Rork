import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const cfg=require('../app.config.js');
function forEnv(values) {
 const keys=['BUKLOD_APP_TARGET','APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {
   for(const k of keys) delete process.env[k];
   Object.assign(process.env,values);
   return cfg({config:{}});
 } finally {
   for(const k of keys) { if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k]; }
 }
}
test('Genesis offline QA is a distinct package with no network permission or OTA',()=>{
 const args={APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true'};
 const qa=forEnv({...args,EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA:'true'});
 const stage=forEnv(args);
 const prod=forEnv({APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production',EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA:'true'});
 assert.equal(qa.android.package,'org.mzbministry.buklod.genesisqa');
 assert.equal(qa.name,'BUKLOD Genesis Visual QA');
 assert.equal(qa.scheme,'buklod-genesis-qa');
 assert.equal(qa.runtimeVersion,'2.0.0-genesis-preview');
 assert.equal(qa.updates.enabled,false);
 assert.ok(qa.android.blockedPermissions.includes('android.permission.INTERNET'));
 assert.equal(stage.android.package,'org.mzbministry.buklod.staging');
 assert.equal(stage.runtimeVersion,'2.0.0-genesis-preview');
 assert.equal(stage.android.blockedPermissions.includes('android.permission.INTERNET'),false);
 assert.equal(prod.android.package,'org.mzbministry.buklod');
 assert.equal(prod.runtimeVersion,'1.3.2');
 assert.equal(prod.android.blockedPermissions.includes('android.permission.INTERNET'),false);
 assert.equal(qa.plugins.find(p=>Array.isArray(p)&&p[0]==='react-native-google-mobile-ads')[1].androidAppId,'ca-app-pub-3940256099942544~3347511713');
});
test('offline QA entry never boots auth, push, PTT, live routes or production app',()=>{
 const src=read('index.js');
 assert.match(src,/EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA === 'true'/);
 assert.match(src,/GenesisRenderQaEntry/);
 assert.match(src,/registerRootComponent/);
 const start=src.indexOf("if (process.env.EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA");
 const other=src.indexOf('} else {');
 assert.ok(start>0&&other>start);
 const isolated=src.slice(start,other);
 assert.doesNotMatch(isolated,/setFirebaseListeners|setPushConfig|buklodPttBootstrap|expo-router\/entry/);
 assert.match(src.slice(other),/expo-router\/entry/);
 const app=read('src/features/season2/genesis/GenesisRenderQaEntry.tsx');
 for(const native of ['GenesisHomeHero','GenesisAtmosphere','GenesisOrbitHalo','GenesisSeal','GenesisRankBadgeArtwork','GenesisRewardReveal','GenesisCosmicSky']) assert.ok(app.includes(native),native);
 assert.match(app,/NO LOGIN · NO LIVE DATA/);
 assert.doesNotMatch(app,/supabase-js|createClient|fetch\(|axios|router\.|AsyncStorage|awardPoints|startActivity/);
});
test('QA release workflow emits installable embedded-JS APK without production internet access',()=>{
 const w=read('.github/workflows/genesis-render-qa-apk-20261120.yml');
 assert.match(w,/BUKLOD_GENESIS_RENDER_QA_BUILD/);
 assert.match(w,/assembleRelease/);
 assert.match(w,/EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA: 'true'/);
 assert.match(w,/genesisqa/);
 assert.match(w,/android\.permission\.INTERNET/);
 assert.match(w,/apksigner verify/);
 assert.match(w,/actions\/upload-artifact@v4/);
 assert.doesNotMatch(w,/eas (build|update)|--profile production|deploy-prod|supabase db/);
});
