import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const directory = 'assets/sounds/kingdom-premium/';
const items = ['kingdom-score','click','pop','impact','riser','whoosh','tick'];
const meta = JSON.parse(read(directory+'assets.json'));

test('all seven recorded MP3s are bundled and verified against pinned CC0 manifest', () => {
  assert.equal(meta.license,'CC0-1.0');
  assert.deepEqual(Object.keys(meta.outputs).sort(),items.map(x=>x+'.mp3').sort());
  for(const key of items){
    const name=key+'.mp3', buffer=fs.readFileSync(path.join(root,directory,name));
    assert.ok(buffer.length>500,'bad asset: '+name);
    assert.equal(crypto.createHash('sha256').update(buffer).digest('hex'),meta.outputs[name].sha256);
    assert.ok(meta.outputs[name].duration>0);
    assert.ok(buffer.toString('ascii',0,3)==='ID3'||(buffer[0]===0xff&&(buffer[1]&0xe0)===0xe0),'invalid mp3: '+name);
  }
  assert.ok(meta.outputs['kingdom-score.mp3'].duration>=51&&meta.outputs['kingdom-score.mp3'].duration<=54);
});

test('audio sources are exact pinned CC0 releases, not mutable CDN routes', () => {
  const urls=Object.values(meta.sources).map(v=>v.url);
  assert.equal(urls.length,7);
  assert.ok(urls.some(u=>u.includes('gtherond/crown-of-embers/06c4583f2ac7f36ddd5eb244e567e7caa0cfbf83/')));
  assert.equal(urls.filter(u=>u.includes('Barty-Bart/motion-graphics/3d83d987d658601d8a1269eb691622bdcd427335/')).length,6);
  assert.ok(urls.every(u=>u.startsWith('https://raw.githubusercontent.com/')));
  assert.ok(urls.every(u=>!u.includes('/main/')&&!u.includes('/master/')));
});

test('kingdom events use real local cues, never app notifications or synthetic WebAudio', () => {
  const a=read('src/features/games/runtime/rorkAudio.ts');
  const n=read('src/features/games/runtime/BuklodGameFeedback.native.ts');
  const w=read('src/features/games/runtime/BuklodGameFeedback.web.ts');
  assert.match(a,/const LOCAL_CUES: Record<RorkAudioKey, number>/);
  for(const name of items)assert.ok(a.includes('kingdom-premium/'+name+'.mp3'));
  for(const evt of ['move','collect','impact','success','failure','unlock'])assert.ok(a.includes(evt+':'));
  assert.doesNotMatch(a,/REMOTE_RORK_AUDIO_ENABLED|RORK_AUDIO\[/);
  assert.doesNotMatch(n,/buklod_community|buklod_error|buklod_message_sent|buklod-reaction|buklod-points-claim|buklod_achievement/);
  assert.doesNotMatch(w,/createOscillator|AudioContext|frequency\.setValueAtTime/);
  assert.match(n,/Haptics\.notificationAsync/);
});

test('calls, app background, focus cleanup, multiple taps and silent preference remain safe', () => {
  const a=read('src/features/games/runtime/rorkAudio.ts');
  const sounds=read('src/lib/buklodSounds.ts');
  for(const token of ['AppState.currentState','isBuklodGameSoundEnabled','useFocusEffect','silenceCues','perVoiceGeneration.get(player) === generation','p.remove()','audio.remove()','!gameId || !musicEnabled'])
    assert.ok(a.includes(token),'missing audio safety: '+token);
  assert.match(sounds,/if \(!settings\.games \|\| activeCall\) return false/);
  assert.match(sounds,/if \(settings\.quietHours\)/);
  assert.match(a,/const voiceCount:/);
  assert.match(a,/status.playing && !isBuklodGameSoundEnabled\(\)/);
});
