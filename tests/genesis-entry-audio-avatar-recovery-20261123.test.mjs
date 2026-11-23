import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');
test('gated, original entry WAV is locally bundled with no network dependency',()=>{
 const src=read('src/features/season2/genesis/useGenesisEntryAudio.ts');
 const wav=readFileSync('assets/sounds/buklod-genesis-opening-20261120.wav');
 assert.equal(wav.toString('ascii',0,4),'RIFF');
 assert.equal(wav.toString('ascii',8,12),'WAVE');
 assert.ok(wav.length<160000);
 assert.match(src,/getBuklodSoundSettings\(\)/);
 assert.match(src,/isBuklodGameSoundEnabled\(\)/);
 assert.match(src,/subscribeBuklodAudioFocus/);
 assert.match(src,/playbackStatusUpdate/);
 assert.match(src,/\.remove\(\)/);
 assert.doesNotMatch(src,/fetch\(|https:\/\//);
});
test('map waits for cinematic exit, authentication and consent before intro and ambience',()=>{
 const intro=read('src/features/season2/genesis/GenesisCinematicStartup.tsx');
 const map=read('src/app/buklod-map.tsx');
 assert.match(intro,/setGenesisOpeningVisible\(visible\)/);
 assert.match(map,/useSyncExternalStore/);
 assert.match(map,/!introVisible/);
 assert.match(map,/useGenesisEntryAudio\(canPlayMusic && focused && !introVisible\)/);
 assert.match(map,/autoStart:canPlayMusic && focused && entryAudioReady/);
 assert.match(map,/requiresAcceptance/);
});
test('all 13 original Godot heroes have real 8-frame native sprite fallback; selected identity reaches renderer',()=>{
 const native=read('src/features/season2/genesis/GenesisRiveCharacter.native.tsx');
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 for(const id of ['ace','angel','christian','ellusur','jawo','lhen','mitch','niel','phan','quin','trudice','van','vhen']){
  assert.ok(existsSync('godot/empire-arena/art/fullbody/'+id+'_idle.png'),id);
  assert.ok(native.includes("fullbody/"+id+"_idle.png"),id);
 }
 assert.match(native,/setInterval\(\(\)=>setFrame\(value=>\(value\+1\)%8\),125\)/);
 assert.match(native,/isReduceMotionEnabled/);
 assert.match(native,/AppState.addEventListener/);
 assert.match(portal,/rigId=\{selected\.character\}/);
 assert.doesNotMatch(native,/floatY|hand-wave-outline/);
});
test('welcome guide uses original portraits; no fake hand icon and no crop overlay on failed image',()=>{
 const dock=read('src/features/season2/world/BuklodMapGuideDock.tsx');
 const portrait=read('src/features/season2/genesis/GenesisApprovedEntryMap.tsx');
 const reliable=read('src/features/season2/genesis/GenesisReliablePortraitImage.tsx');
 for(const pose of ['wave','celebrate','think']) assert.ok(dock.includes('buklod-guide/'+pose+'.png'));
 assert.doesNotMatch(dock,/hand-wave-outline/);
 assert.match(portrait,/imageReady\?<GenesisOriginalGuideMotion/);
 assert.match(reliable,/onImageReadyChange/);
});

test('previously staged PTT fix stays cumulative: map music ducks without restarting',()=>{
 const focus=read('src/lib/buklodAudioFocus.ts');
 const runtime=read('src/ptt/buklodPttRuntime.ts');
 const ambient=read('src/features/games/runtime/rorkAudio.ts');
 const intro=read('src/features/season2/genesis/useGenesisEntryAudio.ts');
 assert.match(focus,/subscribeBuklodPttVoiceActivity/);
 assert.match(runtime,/setBuklodPttVoiceActive\\(Boolean\\(/);
 assert.match(runtime,/normalReceivingTransmissionId/);
 assert.match(runtime,/clearNormalReceiving\\(String\\(payload\\.transmission_id\\)\\)/);
 assert.match(ambient,/interruptionMode: 'mixWithOthers'/);
 assert.match(ambient,/audio\\.volume = isKingdomMap && pttVoiceActive \\? base \\* 0\\.12 : base/);
 assert.match(ambient,/if \\(audio\\.isLoaded && !audio\\.playing\\) audio\\.play\\(\\)/);
 assert.match(ambient,/releasePttActivity\\(\\)/);
 assert.match(intro,/subscribeBuklodPttVoiceActivity/);
});
