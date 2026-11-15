'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('native GIF is wired into manual comment flow',()=>{
 const k=read('modules/buklod-kingdom-lab/android/src/main/java/expo/modules/buklodlab/BuklodLabNativeModule.kt');
 const n=read('modules/buklod-kingdom-lab/KeyboardGifInput.tsx');
 const m=read('src/components/BuklodMentionField.tsx');
 const c=read('src/components/BuklodCommunityCommentComposer.tsx');
 assert.match(k,/InputConnectionCompat\.createWrapper/);assert.match(k,/stageVerifiedGif/);
 assert.match(n,/requireNativeViewManager\('BuklodLabNative'\)/);
 assert.match(m,/EXPO_PUBLIC_KINGDOM_NATIVE_LAB === '1'/);assert.match(m,/onNativeGif/);
 assert.match(c,/onNativeGif=\{uri =>/);assert.match(c,/onMediaChange\(\{ kind: 'gif', ref: uri \}, uri\)/);
});
test('Godot, native Drive SAF, and plugin are isolated',()=>{
 const gr=read('modules/buklod-kingdom-lab/android/build.gradle');
 const pl=read('plugins/withBuklodKingdomNativeLab.js');
 assert.match(gr,/System\.getenv\('APP_VARIANT'\) != 'native-lab'/);
 assert.match(pl,/process\.env\.APP_VARIANT !== 'native-lab'/);
 assert.match(read('src/lib/buklodLabDrivePicker.ts'),/DocumentPicker\.getDocumentAsync/);
 assert.match(read('src/features/games/kingdom/BuklodKingdomMapPremium.tsx'),/BuklodGodotLabLauncher/);
 const oldV=process.env.APP_VARIANT,oldT=process.env.BUKLOD_APP_TARGET;
 try{
  process.env.BUKLOD_APP_TARGET='main';process.env.APP_VARIANT='native-lab';
  const c=require('../app.config.js');
  assert.equal(c({config:{}}).android.package,'org.mzbministry.buklod.nativeqa');
  assert.ok(c({config:{}}).plugins.includes('./plugins/withBuklodKingdomNativeLab.js'));
  for(const v of ['staging','production']){
   process.env.APP_VARIANT=v;assert.ok(!c({config:{}}).plugins.includes('./plugins/withBuklodKingdomNativeLab.js'));
  }
 }finally{
  if(oldV===undefined)delete process.env.APP_VARIANT;else process.env.APP_VARIANT=oldV;
  if(oldT===undefined)delete process.env.BUKLOD_APP_TARGET;else process.env.BUKLOD_APP_TARGET=oldT;
 }
});
