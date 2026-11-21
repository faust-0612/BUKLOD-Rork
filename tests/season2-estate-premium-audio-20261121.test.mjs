import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const sound=p=>readFileSync(new URL('../assets/sounds/estate-premium/'+p+'.wav',import.meta.url));
const cues=['navigation','preview','customize','apply','claim','buy_open','buy_success','buy_failure','build_start','build_complete','contribute','error','unlock'];
const native=read('src/features/season2/world/estateFeedback.native.ts');
const web=read('src/features/season2/world/estateFeedback.web.ts');
const map=read('src/features/season2/world/Season2DevelopmentMap.tsx');
const consoleSource=read('src/features/season2/world/EstateConstructionConsole.tsx');
const fx=read('src/features/season2/world/EstateMomentFX.tsx');
const icons=read('src/features/season2/world/EstateResourceEmblem.tsx');
const atmosphere=read('src/features/season2/world/EstateGenesisAtmosphere.tsx');

test('13 original offline estate SFX are real bounded 24kHz stereo 16-bit PCM WAV, not broken placeholders',()=>{
 const hashes=new Set();
 for(const cue of cues){
   const wav=sound(cue);
   assert.equal(wav.toString('ascii',0,4),'RIFF',cue);
   assert.equal(wav.toString('ascii',8,12),'WAVE',cue);
   assert.equal(wav.toString('ascii',12,16),'fmt ',cue);
   assert.equal(wav.readUInt16LE(20),1,'PCM '+cue);
   assert.equal(wav.readUInt16LE(22),2,'stereo '+cue);
   assert.equal(wav.readUInt32LE(24),24000,'sample rate '+cue);
   assert.equal(wav.readUInt16LE(34),16,'16-bit '+cue);
   assert.equal(wav.toString('ascii',36,40),'data',cue);
   assert.equal(wav.readUInt32LE(4),wav.length-8,'RIFF length '+cue);
   assert.equal(wav.readUInt32LE(40),wav.length-44,'data length '+cue);
   assert.ok(wav.length>=20000&&wav.length<150000,'bounded sample '+cue);
   let energy=0,peak=0;
   for(let i=44;i<wav.length;i+=10){
     const v=wav.readInt16LE(i);
     energy+=v*v;peak=Math.max(peak,Math.abs(v));
   }
   assert.ok(peak>1000, 'audible signal '+cue);
   assert.ok(energy>1000000, 'not silent '+cue);
   hashes.add(createHash('sha256').update(wav).digest('hex'));
   assert.ok(native.includes('estate-premium/'+cue+'.wav'),'native asset binding '+cue);
 }
 assert.equal(hashes.size,cues.length,'each event gets a distinct sound');
});
test('correct sound events are tied to actual RPC success, not button initiation',()=>{
 assert.match(consoleSource,/await fn\(\)/);
 assert.match(consoleSource,/onMomentRef\.current\?\.\(typeof cue/);
 assert.match(consoleSource,/,'build_start'\)/);
 assert.match(consoleSource,/'build_complete':'claim'/);
 assert.match(consoleSource,/,'apply'\)/);
 assert.match(consoleSource,/'contribute'\)/);
 assert.match(consoleSource,/onMomentRef\.current\?\.\('error'\)/);
 assert.match(map,/door\.id==='market'\?'buy_open':'navigation'/);
 assert.doesNotMatch(map,/handleEstateMoment\('buy_success'\)/);
 assert.doesNotMatch(consoleSource,/onMomentRef\.current\?\.\('buy_success'\)/);
});
test('voice, permissions, focus, quiet hours, and optional audio failure remain non-blocking',()=>{
 assert.match(native,/VOICE_KEY/);
 assert.match(native,/Speech\.getAvailableVoicesAsync\(\)/);
 assert.match(native,/chooseBibleNarrationVoice\(voices,'fil-PH'\)/);
 assert.match(native,/getBuklodSoundSettings/);
 assert.match(native,/isBuklodGameSoundEnabled/);
 assert.match(native,/subscribeBuklodAudioFocus/);
 assert.match(native,/AppState\.currentState/);
 assert.match(native,/settings\.quietHours/);
 assert.match(native,/if\(!spoken\|\|!voiceRef\.current\)return/);
 assert.match(native,/Speech\.stop\(\)/);
 assert.match(native,/AppState\.addEventListener\('change'/);
 assert.match(native,/pendingDecodes\.current\.clear\(\)/);
 assert.match(web,/useEstateFeedback/);
 assert.match(map,/estateFeedback\.toggleVoice/);
 assert.match(map,/estateFeedback\.voiceEnabled/);
 assert.match(native,/for\(const player of players\.current\.values\(\)\)/);
});
test('confirmation FX and resource imagery use bundled renderers and respect reduced motion',()=>{
 for(const cue of ['apply','claim','build_start','build_complete','contribute','error','unlock']){
   assert.ok(fx.includes(cue+':{label:'));
 }
 assert.match(fx,/AccessibilityInfo\.isReduceMotionEnabled/);
 assert.match(fx,/pointerEvents="none"/);
 assert.match(atmosphere,/AccessibilityInfo\.isReduceMotionEnabled/);
 assert.match(atmosphere,/useFocusEffect/);
 assert.match(atmosphere,/loop\.stop\(\)/);
 assert.match(map,/<EstateGenesisAtmosphere world=\{world\} level=\{level\}/);
 assert.match(map,/<EstateMomentFX event=\{estateMoment\}/);
 assert.match(consoleSource,/<EstateResourceEmblem kind=\{field\}/);
 assert.match(consoleSource,/<DevelopmentStructurePreview track=\{track\} level=\{verified\.level\}/);
 for(const asset of ['development_xp','timber','stone','metal'])assert.ok(icons.includes("kind==='"+asset+"'"));
});

test('verified construction FX animate wood, stone, metal and crystal resources with stage-specific visuals',()=>{
 for(const resource of ['timber','stone','metal','development_xp'])assert.ok(fx.includes("'"+resource+"'"));
 assert.match(fx,/EstateResourceEmblem kind=\{resource\}/);
 assert.match(fx,/earningMilestone/);
 assert.match(fx,/usingMaterials/);
 assert.match(fx,/showingDesign/);
 assert.match(fx,/EstateCosmeticTile family="finish"/);
 assert.match(map,/cosmetics=\{visualDesign\}/);
 const render=read('src/features/season2/world/DevelopmentStructurePreview.tsx');
 for(const stage of ['s===0','s>=1','s>=2','s===3'])assert.ok(render.includes(stage),'distinct construction visualization '+stage);
 assert.match(render,/timber-material/);
 assert.match(render,/stone-material/);
 assert.match(render,/s<4/);
 assert.ok(render.indexOf('M20 172 L201 95')<render.indexOf('timber-material'),'resources must render above the ground plane');
});

test('late scope RPC responses cannot overwrite a new estate design or contribution wallet',()=>{
 const c=consoleSource;
 const awaited=c.indexOf('const snapshot=await fn()');
 const guard=c.indexOf('if(request!==actionSeq.current)return',awaited);
 const saved=c.indexOf('onApplyRef.current(snapshot.cosmetics)',awaited);
 const donated=c.indexOf('setDonation({...ZERO})',awaited);
 assert.ok(awaited>=0&&guard>awaited&&saved>guard&&donated>guard);
 assert.doesNotMatch(c,/onApplyRef.current\(next.cosmetics\)/);
 assert.doesNotMatch(c,/setPersonalWallet\(mine\?\.wallet/);
 assert.match(c,/if\(request===actionSeq.current\)setPersonalWallet\(mine.wallet\)/);
 assert.match(c,/onMomentRef.current\?\.\(resolvedCue\)/);
});
