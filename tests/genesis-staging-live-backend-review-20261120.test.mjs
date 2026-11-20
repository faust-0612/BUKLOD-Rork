import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const req=createRequire(import.meta.url);
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const config=req('../app.config.js');
function runWithEnv(e){
 const names=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA'];
 const prev=Object.fromEntries(names.map(n=>[n,process.env[n]]));
 try {
  names.forEach(n=>delete process.env[n]);
  Object.assign(process.env,e);
  return config({config:{}});
 } finally {
  names.forEach(n=>prev[n]===undefined?delete process.env[n]:process.env[n]=prev[n]);
 }
}
test('Genesis staging full app uses version 2.0.0 and distinct native runtime/channel with existing backend only for live features',()=>{
 const eas=JSON.parse(read('eas.json'));
 const stage=eas.build['season2-genesis-preview'];
 assert.equal(stage.env.APP_VARIANT,'staging');
 assert.equal(stage.env.EXPO_PUBLIC_APP_ENV,'staging');
 assert.equal(stage.env.EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW,'true');
 assert.equal(stage.env.EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW,'true');
 assert.equal(stage.env.EXPO_PUBLIC_SUPABASE_URL,'https://yhanxndaqbmuzbdqlblu.supabase.co');
 assert.match(stage.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,/^sb_publishable_[A-Za-z0-9_-]+$/);
 assert.doesNotMatch(JSON.stringify(stage.env),/service_role|sb_secret_/i);
 assert.equal(stage.channel,'season2-genesis-preview');
 assert.equal(stage.android.buildType,'apk');
 const cfg=runWithEnv(stage.env);
 assert.equal(cfg.android.package,'org.mzbministry.buklod.staging');
 assert.equal(cfg.version,'2.0.0');
 assert.equal(cfg.runtimeVersion,'2.0.0-genesis-preview');
 assert.equal(cfg.updates.url,'https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8');
 assert.notEqual(cfg.updates.enabled,false);
 assert.ok(!cfg.android.blockedPermissions.includes('android.permission.INTERNET'));
 assert.equal(cfg.plugins.find(p=>Array.isArray(p)&&p[0]==='react-native-google-mobile-ads')[1].androidAppId,'ca-app-pub-3940256099942544~3347511713');
 const prod=runWithEnv({APP_VARIANT:'production',EXPO_PUBLIC_APP_ENV:'production'});
 assert.equal(prod.android.package,'org.mzbministry.buklod');
 assert.equal(prod.version,'1.3.6');
 assert.equal(prod.runtimeVersion,'1.3.2');
 assert.equal(eas.build.production.channel,'production');
 assert.ok(!eas.build.production.env.EXPO_PUBLIC_BUKLOD_GENESIS_SHARED_BACKEND_REVIEW);
 const oldstage=runWithEnv({APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging'});
 assert.equal(oldstage.version,'1.3.6');
});
test('staging bundle boots the actual router/auth providers, not an offline mock or synthetic rewards',()=>{
 const entry=read('index.js');
 assert.match(entry,/require\('expo-router\/entry'\)/);
 assert.match(entry,/setFirebaseListeners/);
 assert.match(entry,/setPushConfig/);
 assert.match(entry,/buklodPttBootstrap/);
 assert.doesNotMatch(entry,/GenesisRenderQaEntry|EXPO_PUBLIC_BUKLOD_GENESIS_RENDER_QA/);
 const layout=read('src/app/_layout.tsx');
 assert.match(layout,/<AuthProvider>/);
 assert.match(layout,/<BuklodMandatoryUpdateBoundary>/);
 assert.match(layout,/<AdsProvider>/);
 assert.match(layout,/<StreamVideoProvider>/);
 const season=read('src/features/season2/genesis/seasonThemeAuthority.ts');
 assert.match(season,/activation:'release-gated'/);
 const rewards=read('src/features/season2/genesis/GenesisRewardReveal.tsx');
 assert.match(rewards,/parent must already have a verified reward receipt/);
});
test('signed release workflow requires exact stage runtime and the approved shared main project; leaves production alone',()=>{
 const w=read('.github/workflows/genesis-season2-staging-release-apk-20261120.yml');
 assert.match(w,/BUKLOD_GENESIS_STAGING_APK_START/);
 assert.match(w,/BUKLOD_GENESIS_SHARED_BACKEND_REVIEW/);
 assert.match(w,/\[\[ "\$EXPO_PUBLIC_SUPABASE_URL" == https:\/\/yhanxndaqbmuzbdqlblu\.supabase\.co \]\]/);
 assert.match(w,/assert.equal\(cfg.version,'2\.0\.0'\)/);
 assert.match(w,/npx --yes eas-cli@27\.9\.0 build --platform android --profile season2-genesis-preview/);
 assert.match(w,/node scripts\/genesis-verify-signed-apk\.mjs --receipt=/);
 assert.doesNotMatch(w,/eas-cli[^\n]*update --|--profile production/);
});
