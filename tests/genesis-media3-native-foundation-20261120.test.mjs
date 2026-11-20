import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('isolated Media3 Android transcoder has matched 1.11.1 native modules and Expo autolinking',()=>{
 const native=JSON.parse(read('modules/buklod-genesis-media3/expo-module.config.json'));
 assert.equal(native.android.modules[0],'expo.modules.buklodgenesismedia3.BuklodGenesisMedia3Module');
 const workflow=read('.github/workflows/genesis-android-compile-smoke-20261120.yml');
 assert.match(workflow,/^      - tests\/genesis-media3-native-foundation-20261120\.test\.mjs$/m);
 assert.match(workflow,/node --test tests\/genesis-native-ime-gradle-compatibility-20261120\.test\.mjs tests\/genesis-play-core-native-foundation-20261120\.test\.mjs tests\/genesis-media3-native-foundation-20261120\.test\.mjs/);
 const gradle=read('modules/buklod-genesis-media3/android/build.gradle');
 for(const dep of ['media3-common','media3-effect','media3-transformer']){
   assert.ok(gradle.includes('androidx.media3:'+dep+':1.11.1'),dep+' mismatch');
 }
 assert.match(gradle,/versionCode 1[\s\S]*versionName '1\.0\.0'/);
});
test('video compression is opt-in, on local files only, bounded and safe for playback/ads',()=>{
 const kotlin=read('modules/buklod-genesis-media3/android/src/main/java/expo/modules/buklodgenesismedia3/BuklodGenesisMedia3Module.kt');
 assert.match(kotlin,/maxInputBytes = 250L \* 1024 \* 1024/);
 assert.match(kotlin,/"content" ->/);
 assert.match(kotlin,/"file" ->/);
 assert.match(kotlin,/canonicalFile/);
 assert.match(kotlin,/startsWith\("video\/"\)/);
 assert.match(kotlin,/pending != null/);
 assert.match(kotlin,/maxHeight !in listOf\(480, 720, 1080\)/);
 assert.match(kotlin,/Presentation\.createForHeight/);
 assert.match(kotlin,/VideoEncoderSettings\.Builder\(\)\.setBitrate/);
 assert.match(kotlin,/setVideoMimeType\(MimeTypes\.VIDEO_H264\)/);
 assert.match(kotlin,/setAudioMimeType\(MimeTypes\.AUDIO_AAC\)/);
 assert.match(kotlin,/handler\.postDelayed\(it, 180_000\)/);
 assert.match(kotlin,/transformer\?\.cancel\(\)/);
 assert.match(kotlin,/smallerThanInput/);
 assert.doesNotMatch(kotlin,/httpClient|uploadAsync|fetch\(|Supabase|AdMob/);
 const wrapper=read('modules/buklod-genesis-media3/index.ts');
 assert.match(wrapper,/EXPO_PUBLIC_BUKLOD_SEASON2_GENESIS_PREVIEW !== 'true'/);
 assert.match(wrapper,/candidate\?\.smallerThanInput/);
 assert.match(wrapper,/return null; \/\/ existing resumable video upload remains authoritative/);
 const inv=JSON.parse(read('release/genesis-native-build-inventory-20261120.json'));
 assert.equal(inv.nativeFeatures.find(x=>x.id==='native-media3-compression').status,'native-source-uncompiled');
 assert.equal(inv.signedApk.exists,false);
});
