import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const anchor='c413c1ec2e23f151af0123cefbd4209fbf612d1f';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('OTA source retains identical Android native architecture, dependencies and four-world Godot pack',()=>{
 const restricted=['app.config.js','eas.json','package.json','package-lock.json','modules','plugins','godot','scripts/build-empire-godot-pack.mjs','scripts/arena-library-audio-pack.mjs','assets/season2/arena'];
 const files=execFileSync('git',['diff','--name-only',anchor,'HEAD','--',...restricted],{encoding:'utf8',timeout:10000}).trim();
 assert.equal(files,'','Native APK source drift: '+files);
 const godot=read('src/app/games/empire-arena.tsx');
 assert.match(godot,/openBundledEmpireArena/);
 assert.match(godot,/godotNativeEnabled/);
 const worlds=read('src/features/season2/world/Season2DevelopmentMap.tsx');
 assert.match(worlds,/openBundledBuklodWorld/);
 assert.match(worlds,/nativeWorldPreview/);
});
test('OTA exports exactly the installed 2.0.4 staging channel and no production key',()=>{
 const keys=['APP_VARIANT','EXPO_PUBLIC_APP_ENV','EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW','EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED','EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS','EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE','BUKLOD_APP_TARGET'];
 const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try {
   Object.assign(process.env,{APP_VARIANT:'staging',EXPO_PUBLIC_APP_ENV:'staging',BUKLOD_APP_TARGET:'main',EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW:'true',EXPO_PUBLIC_BUKLOD_ARENA_GODOT_ENABLED:'true',EXPO_PUBLIC_BUKLOD_GENESIS_GODOT_WORLDS:'true',EXPO_PUBLIC_BUKLOD_ARENA_LIBRARY_BUNDLE:'true'});
   const app=require('../app.config.js')({config:{}});
   const eas=require('../eas.json');
   assert.equal(app.android.package,'org.mzbministry.buklod.staging');
   assert.equal(app.runtimeVersion,'2.0.4-genesis-library-godot');
   assert.equal(app.version,'2.0.4');
   assert.equal(app.extra.appTarget,'main');
   assert.ok(app.plugins.includes('./plugins/withBuklodGodotArenaPack.js'));
   assert.equal(eas.build['season2-genesis-library-staging'].channel,'season2-genesis-library-preview');
   assert.notEqual(eas.build.production.channel,'season2-genesis-library-preview');
   const testAds=app.plugins.find(p=>Array.isArray(p)&&p[0]==='react-native-google-mobile-ads');
   assert.equal(testAds[1].androidAppId,'ca-app-pub-3940256099942544~3347511713');
 } finally {for(const k of keys){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k]}}
});
test('approved UI fixes are present without deleting home ads and major tabs',()=>{
 const home=read('src/app/(tabs)/hub.tsx');
 assert.match(home,/BuklodFirstViewAd/);
 assert.match(home,/BuklodNativeSponsoredCard/);
 const files=['src/app/(tabs)/_layout.tsx','src/app/(tabs)/buklod.tsx','src/app/(tabs)/me.tsx',
  'src/components/BuklodCommunityCommentThread.tsx','src/components/BuklodCommunityPhotoCollage.tsx',
  'src/components/CommunityVideo.tsx','src/lib/buklodAudioFocus.ts','src/lib/buklodCallJwt.ts',
  'src/components/BuklodDashboardContextBar.tsx'];
 for(const p of files)assert.ok(read(p).length>250,'Missing approved content: '+p);
});
test('staging OTA publication workflow is staged-only and immutable-runtime verified',()=>{
 const workflow=read('.github/workflows/genesis-library-204-staging-ota-publish.yml');
 assert.match(workflow,/season2-genesis-library-preview/);
 assert.match(workflow,/2\.0\.4-genesis-library-godot/);
 assert.match(workflow,/c413c1ec2e23f151af0123cefbd4209fbf612d1f/);
 assert.match(workflow,/channel:view production/);
 assert.match(workflow,/update --channel/);
 assert.match(workflow,/--platform android/);
 assert.doesNotMatch(workflow,/\beas\s+submit\b|\beas\s+build\b|\bexpo\s+publish\b/);
});
