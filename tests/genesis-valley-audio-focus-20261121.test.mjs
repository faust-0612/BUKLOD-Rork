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

test('Retired Entry Map redirects to Home without mounting music or advertisements',()=>{
 const map=read('src/app/buklod-map.tsx');
 assert.match(map,/<Redirect href="\/\(tabs\)\/hub"/);
 assert.doesNotMatch(map,/useRorkGameAmbience|canPlayMusic|features\/games/);
 assert.doesNotMatch(map,/toggleMusic|musicButton|BuklodFirstViewAd|Music on/);
 const audio=read('src/features/games/runtime/rorkAudio.ts');
 const sound=read('src/features/games/runtime/kingdomPremiumAudioAssets.ts');
 const licenses=read('assets/sounds/kingdom-premium/LICENSES.md');
 assert.match(audio,/controlledAutoStart/);
 assert.match(audio,/subscribeBuklodAudioFocus/);
 assert.match(sound,/if \(gameId === 'kingdom-map'\) return MUSIC\.adventure/);
 assert.match(licenses,/Creative Commons Zero \(CC0 1.0\)/);
});
