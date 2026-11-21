import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const media=read('src/features/games/runtime/rorkMedia.ts');
const audio=read('src/features/games/runtime/rorkAudio.ts');
const center=read('src/features/games/kingdom/platform/KingdomInteriorCenter.tsx');
const catalog=JSON.parse(read('src/features/games/kingdom/platform/game-catalog.json'));
test('all 26 optional games receive catalog-bound, locally packaged genre sound cues',()=>{
 const pilot=catalog.characters.flatMap(c=>c.games.filter(g=>g.status==='pilot').map(g=>g.id));
 assert.equal(pilot.length,26);
 for(const id of pilot)assert.match(media,new RegExp("'"+id+"':'(?:coins|pickup|ui_confirm|unlock|beat_hit|beat_combo|mission_go|build_hit)'"));
 assert.match(media,/PILOT_SIGNATURE_SFX/);
 assert.match(center,/playRorkSignatureSfx\(option.id\)/);
 assert.match(audio,/if \(!isBuklodGameSoundEnabled\(\)\) return false/);
 assert.match(audio,/focusedKingdomViews === 0 \|\| AppState.currentState !== 'active'/);
 assert.match(audio,/getPremiumKingdomSfx\(key\)/);
 assert.doesNotMatch(center,/supabase\.rpc|awardBP|mintShards/);
});
