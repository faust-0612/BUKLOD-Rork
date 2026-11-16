import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {ADVENTURE_CUE_SOUND,ADVENTURE_CUE_LABEL,ADVENTURE_MOTION,cueForAdventureAction} = await import('../src/lib/kingdomAdventurePresentation.ts');

test('every meaningful successful adventure action has a distinct vetted local sound mapping',()=>{
 const actions=['chapter','practice','gift','craft','exchange','refine','gate','ascend'];
 for(const action of actions){assert.ok(ADVENTURE_CUE_SOUND[cueForAdventureAction(action)]);}
 assert.equal(cueForAdventureAction('craft'),'relic');
 assert.equal(cueForAdventureAction('unknown'),'invalid');
 assert.notEqual(ADVENTURE_CUE_SOUND.practice,ADVENTURE_CUE_SOUND.relic);
 assert.notEqual(ADVENTURE_CUE_SOUND.ascend,ADVENTURE_CUE_SOUND.gate);
 assert.equal(ADVENTURE_CUE_SOUND.badge,'victory-alt');
});
test('no music streaming, notification chirps, synthesized beep or unlicensed new sounds',()=>{
 const audio=read('src/features/games/kingdom/useKingdomAdventureAudio.ts');
 for(const key of Object.values(ADVENTURE_CUE_SOUND)){
  assert.ok(audio.includes(`kingdom-premium/${key}.wav`),key);
 }
 assert.ok(!audio.includes('https://'));
 assert.ok(!audio.includes('buklod_message'));
 assert.ok(!audio.includes('Oscillator'));
});
test('audio obeys navigation and background cleanup, sound settings, and bounds',()=>{
 const audio=read('src/features/games/kingdom/useKingdomAdventureAudio.ts');
 for(const needle of ['useFocusEffect','AppState.currentState','isBuklodGameSoundEnabled()',
   'getBuklodSoundSettings()','current.seekTo(0)','p.pause()','p.remove()', 'generation.current']){
  assert.ok(audio.includes(needle),needle);
 }
 assert.ok(ADVENTURE_MOTION.maximumActiveSounds<=4);
 assert.ok(ADVENTURE_MOTION.minimumSoundIntervalMs>=100);
});
test('animations respect Reduce Motion and never run on blurred/backgrounded scenes',()=>{
 const ui=read('src/features/games/kingdom/KingdomAdventureMotion.tsx');
 for(const needle of ['useBuklodReduceMotion','useFocusEffect','AppState.addEventListener',
  'loop.stop()','idle.stopAnimation()','reveal.stopAnimation()','getBuklodSpecialLevelAsset','BuklodProgressiveCharacterArt',
  'pointerEvents="none"','useNativeDriver:true'])assert.ok(ui.includes(needle),needle);
 assert.ok(ADVENTURE_MOTION.celebrationDurationMs<=1000);
 assert.ok(ADVENTURE_MOTION.sparkCount<=8);
});
test('new route only celebrates persisted local action changes and uses verified hero level artwork',()=>{
 const ui=read('src/app/games/character-experience.tsx');
 for(const needle of ['actOnCharacterAdventure','if (result.changed)', 'setMoment({id:++momentSerial.current,cue})',
  'setOfficialLevel(selection.character_level??1)', 'KingdomAdventureHeroScene','badgeTier(profile,id)!==badgeTier(result.state,id)',
  'LOCAL ADVENTURE','Memory Dust'])assert.ok(ui.includes(needle),needle);
 assert.ok(ui.indexOf('setMoment({id:++momentSerial.current,cue})')>ui.indexOf('if (result.changed)'));
});
test('core presentation rules are executable TypeScript and UI route keeps event-driven controls',()=>{
 for(const file of ['src/lib/kingdomAdventurePresentation.ts']){
  const stripped=stripTypeScriptTypes(read(file),{mode:'transform'});
  assert.ok(stripped.includes('ADVENTURE_MOTION'));
 }
 const route=read('src/app/games/character-experience.tsx');
 const motion=read('src/features/games/kingdom/KingdomAdventureMotion.tsx');
 const audio=read('src/features/games/kingdom/useKingdomAdventureAudio.ts');
 for(const [s,needles] of [[route,['export default function CharacterExperienceScreen','<ScrollView','<KingdomAdventureHeroScene','setPage(']],
 [motion,['useFocusEffect','useNativeDriver:true','pointerEvents="none"']],
 [audio,['useFocusEffect','getBuklodSoundSettings','generation.current']]]){
  for(const needle of needles)assert.ok(s.includes(needle),needle);
 }
 // Full React Native/Metro TSX compilation remains a separate mandatory RC gate.
});
test('all celebration label states are explicit and reward meaning does not imply cash',()=>{
 for(const cue of ['chapter','practice','gift','relic','refine','gate','ascend','badge']){
  assert.ok(ADVENTURE_CUE_LABEL[cue].length>=8);
  assert.ok(!/cash|earnings|withdraw/i.test(ADVENTURE_CUE_LABEL[cue]));
 }
});
