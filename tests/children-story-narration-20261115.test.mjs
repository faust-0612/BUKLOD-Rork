import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { StoryNarrator, findNarrationVoice, splitStoryNarration } from '../src/features/childrenStories/storyNarration.ts';

const voice = (identifier,language,quality='Default') => ({identifier,language,quality});
const voices=[voice('android-fil','fil-PH'),voice('android-tl','tl-PH'),voice('android-en','en-US','Enhanced')];
function mockSpeech(available=voices) {
  const calls=[], stops=[];
  return {
    calls,stops,
    maxSpeechInputLength: 600,
    speak(text, options) { calls.push({text,options}); },
    async stop(){stops.push('stop');},
    async getAvailableVoicesAsync(){return available;},
  };
}
const events=[];
const narratorFor=port=>new StoryNarrator(port,state=>events.push(state));

test('locale selection chooses actual installed Filipino/Tagalog and English voice',()=>{
  assert.equal(findNarrationVoice(voices,'tl')?.identifier,'android-fil');
  assert.equal(findNarrationVoice([voice('android-tl','tl-PH')],'tl')?.identifier,'android-tl');
  assert.equal(findNarrationVoice(voices,'en')?.identifier,'android-en');
  assert.equal(findNarrationVoice([voice('eng','en-GB')],'en')?.identifier,'eng');
  assert.equal(findNarrationVoice([voice('en','en-US')],'tl'),null);
});

test('long narratives are chunked below Android max input, without omitting words',()=>{
  const input=Array.from({length:250},(_,i)=>'Salaysay'+i+' at pagmamahal sa kapwa.').join(' ');
  for (const max of [120,320,600,4000]) {
    const chunks=splitStoryNarration(input,max);
    assert.ok(chunks.length>1);
    assert.ok(chunks.every(chunk=>chunk.length<=Math.min(650,max-8)));
    assert.equal(chunks.join(' '),input);
  }
  assert.deepEqual(splitStoryNarration('',600),[]);
});
test('every expanded story can be read aloud in both languages with bounded TTS chunks',()=>{
  const files=['bibleExpansionOld.ts','bibleExpansionNew.ts'];
  let count=0;
  for (const file of files) {
    const source=readFileSync(new URL('../src/features/childrenStories/'+file,import.meta.url),'utf8');
    const records=JSON.parse(source.slice(source.indexOf(' = [')+3,source.lastIndexOf(' as const;')));
    for (const entry of records) for(const locale of ['tl','en']){
      const content=entry.acts.map(part=>part[locale]).join('\n\n');
      const chunks=splitStoryNarration(content,600);
      assert.ok(chunks.length>=3,entry.id+' '+locale+' missing chunks');
      assert.ok(chunks.every(chunk=>chunk.length>0 && chunk.length<=592),entry.id+' '+locale);
      count++;
    }
  }
  assert.equal(count,264);
});
test('a multi-chunk story reads serially through the final utterance and returns to idle',async()=>{
  events.length=0;
  const port=mockSpeech();
  const narrator=narratorFor(port);
  const words=Array.from({length:110},()=> 'Magandang kuwento.').join(' ');
  await narrator.play(words,'tl',false);
  assert.equal(port.calls.length,1);
  assert.equal(port.calls[0].options.language,'fil-PH');
  assert.equal(port.calls[0].options.voice,'android-fil');
  port.calls[0].options.onStart();
  assert.equal(events.at(-1).status,'playing');
  for (let i=0;i<port.calls.length;i++){
    assert.ok(port.calls[i].text.length<=592);
    port.calls[i].options.onDone();
    assert.ok(i<20,'TTS callback loop unexpectedly infinite');
  }
  assert.equal(events.at(-1).status,'idle');
  assert.ok(port.calls.length>2,'long tale must use multiple utterances');
  narrator.dispose();
});
test('Android pause/resume continues from last word without unsupported native pause()',async()=>{
  events.length=0;
  const port=mockSpeech();
  const narrator=narratorFor(port);
  await narrator.play('Ito ang kuwento ng isang pamilya na nagtutulungan.','tl');
  port.calls[0].options.onStart();
  port.calls[0].options.onBoundary({charIndex:19,charLength:6});
  narrator.pause();
  assert.equal(events.at(-1).status,'paused');
  await narrator.resume();
  assert.equal(port.calls.length,2);
  assert.equal(port.calls[1].text,'Ito ang kuwento ng isang pamilya na nagtutulungan.'.slice(19));
  port.calls[0].options.onDone();
  assert.equal(port.calls.length,2,'stale callback must not advance playback');
  port.calls[1].options.onStart();
  port.calls[1].options.onDone();
  assert.equal(events.at(-1).status,'idle');
  narrator.dispose();
});
test('rapid play and stop races never continue stale narration',async()=>{
  events.length=0;
  const port=mockSpeech();
  const narrator=narratorFor(port);
  const p1=narrator.play('Unang story','tl');
  const p2=narrator.play('Second story','en',true);
  await Promise.all([p1,p2]);
  assert.equal(port.calls.length,1);
  assert.equal(port.calls[0].text,'Second story');
  assert.equal(port.calls[0].options.voice,'android-en');
  assert.equal(port.calls[0].options.rate,0.77);
  narrator.stop();
  port.calls[0].options.onDone();
  assert.equal(port.calls.length,1);
  assert.equal(events.at(-1).status,'idle');
  narrator.dispose();
});
test('missing Filipino voice fails visibly instead of silently using an English narrator',async()=>{
  events.length=0;
  const port=mockSpeech([voice('en','en-US')]);
  const narrator=narratorFor(port);
  await narrator.play('Magandang araw.','tl');
  assert.equal(port.calls.length,0);
  assert.deepEqual(events.at(-1),{status:'error',problem:'voice-unavailable'});
  narrator.dispose();
});
test('a stalled Android voice engine has a bounded wait and a visible error',async()=>{
  events.length=0;
  const port=mockSpeech();
  port.getAvailableVoicesAsync=()=>new Promise(()=>undefined);
  const narrator=new StoryNarrator(port,state=>events.push(state),15);
  await narrator.play('Subukan ang boses','tl');
  assert.deepEqual(events.at(-1),{status:'error',problem:'engine-unavailable'});
  assert.equal(port.calls.length,0);
  narrator.dispose();
});
test('TTS native playback failure displays a retryable error; no invisible playing state',async()=>{
  events.length=0;
  const port=mockSpeech();
  const narrator=narratorFor(port);
  await narrator.play('Hello children!','en');
  port.calls[0].options.onError(new Error('android voice engine'));
  assert.deepEqual(events.at(-1),{status:'error',problem:'playback-failed'});
  await narrator.play('Hello again!','en');
  assert.equal(port.calls.at(-1).text,'Hello again!');
  narrator.dispose();
});
test('narration is always stopped on background/route changes and reports readable guidance',()=>{
  const reader=readFileSync(new URL('../src/app/children-stories/[id].tsx',import.meta.url),'utf8');
  assert.match(reader,/useFocusEffect\(useCallback\(\(\)=>\(\)=>stop\(\)/);
  assert.match(reader,/AppState\.addEventListener\('change'/);
  assert.match(reader,/narratorRef\.current\?\.dispose\(\)/);
  assert.match(reader,/narrator\(\)\.play\(content,language,bedtime\)/);
  assert.match(reader,/narrator\(\)\.pause\(\)/);
  assert.match(reader,/narrator\(\)\.resume\(\)/);
  assert.match(reader,/voice-unavailable/);
  assert.match(reader,/Pakinggan ang kuwento/);
  assert.match(reader,/media volume/);
});
