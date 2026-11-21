import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Local Genesis map audio yields to competing media and AdMob focus, with bounded lifecycle',()=>{
 const src=read('src/features/games/runtime/rorkAudio.ts');
 const idx=src.indexOf("const releaseAudioFocus = isKingdomMap");
 assert.ok(idx>=0,'Genesis-only audio focus subscription');
 assert.match(src.slice(idx,idx+570),/subscribeBuklodAudioFocus\(owner =>/);
 assert.match(src.slice(idx,idx+570),/owner === 'genesis-valley-map'/);
 assert.match(src.slice(idx,idx+570),/interruptedByOtherAudio = true/);
 assert.match(src,/\|\| interruptedByOtherAudio/);
 assert.match(src,/releaseAudioFocus\(\);/);
 assert.match(src,/readyListener\.remove\(\)/);
 assert.match(src,/stateListener\.remove\(\)/);
 assert.match(src,/audio\.pause\(\)/);
 assert.match(src,/audio\.remove\(\)/);
});

test('Genesis World auto-starts local audio without screen music toggle or first-view ad',()=>{
 const map=read('src/app/buklod-map.tsx');
 const audio=read('src/features/games/runtime/rorkAudio.ts');
 assert.match(map,/useRorkGameAmbience\('kingdom-map',\{autoStart:canPlayMusic\}\)/);
 assert.match(map,/!requiresAcceptance/);
 assert.match(map,/!complianceLoading/);
 assert.match(map,/!runtimeLoading/);
 assert.doesNotMatch(map,/musicButton|Music on|BuklodFirstViewAd/);
 assert.match(audio,/autoStart = isKingdomMap && options\?\.autoStart === true/);
 assert.match(audio,/if \(!isKingdomMap \|\| controlledAutoStart\) return/);
 assert.match(audio,/\|\| interruptedByOtherAudio/);
 const sound=read('src/features/games/runtime/kingdomPremiumAudioAssets.ts');
 assert.match(sound,/if \(gameId === 'kingdom-map'\) return MUSIC\.adventure/);
 const licenses=read('assets/sounds/kingdom-premium/LICENSES.md');
 assert.match(licenses,/Creative Commons Zero \(CC0 1.0\)/);
});
