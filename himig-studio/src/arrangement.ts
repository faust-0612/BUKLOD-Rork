export type Part = 'piano'|'guitar'|'bass'|'strings'|'drums';
export type Config = { key:string; bpm:number; progression:string; genre:string; parts:Part[]; strength:number; vocal:number; ambience:number };
export type Analysis = { key:string; bpm:number; confidence:string };
export type Outcome = { pcm:Int16Array; chords:string[]; sampled:string[]; synthesized:string[]; eventCount:number; rms:number; backingRms:number; harmonyConfidence?:number; lowConfidenceBars?:number; totalBars?:number; resolvedConfig?:Config; songAnalysis?:Analysis };
const NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const PARTS:Record<string,string>={piano:'acoustic_grand_piano',guitar:'acoustic_guitar_nylon',bass:'electric_bass_finger',strings:'string_ensemble_1'};
const PRESETS:Record<string,number[]>={'1564':[0,4,5,3],'6415':[5,3,0,4],'1645':[0,5,3,4],'1451':[0,3,4,0]};
const DEGREES=[0,2,4,5,7,9,11];
type Event={at:number;end:number;note:number;vol:number;part:Part;pan:number};
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const BYTES = 'data:audio/mp3;base64,';

export function analyzeRecording(audio:AudioBuffer):Analysis{
  const rate=audio.sampleRate;
  const data=audio.getChannelData(0);
  const end=Math.min(data.length,rate*32);
  const env=new Float32Array(Math.floor(end/(rate*.015)));
  const step=Math.floor(rate*.015);
  for(let i=0;i<env.length;i++){
    let total=0;
    for(let j=i*step;j<Math.min(end,(i+1)*step);j+=12)total+=Math.abs(data[j]);
    env[i]=total/Math.max(1,Math.ceil(step/12));
  }
  const onset=new Float32Array(env.length);
  for(let i=1;i<env.length;i++)onset[i]=Math.max(0,env[i]-env[i-1]);
  let bestTempo=96,high=-1;
  for(let bpm=65;bpm<=150;bpm++){
    const lag=Math.round(60/bpm/.015);
    let score=0;
    for(let i=lag;i<onset.length;i++)score+=onset[i]*onset[i-lag];
    if(score>high){high=score;bestTempo=bpm;}
  }
  const hist=new Float32Array(12);
  let detected=0;
  const skip=Math.max(1,Math.round(rate/8000));
  for(let start=0;start+1024*skip<end;start+=Math.round(rate*.27)){
    const x=new Float32Array(1024);
    let mean=0,energy=0;
    for(let i=0;i<x.length;i++){x[i]=data[start+i*skip];mean+=x[i];}
    mean/=x.length;
    for(let i=0;i<x.length;i++){x[i]-=mean;energy+=x[i]*x[i];}
    if(energy<.22)continue;
    let score=0,lag=0;
    for(let l=17;l<140;l++){
      let sum=0,a=0,b=0;
      for(let j=0;j<1024-l;j++){sum+=x[j]*x[j+l];a+=x[j]*x[j];b+=x[j+l]*x[j+l];}
      const value=sum/Math.sqrt(a*b+1e-8);
      if(value>score){score=value;lag=l;}
    }
    if(score<.73||!lag)continue;
    const note=Math.round(69+12*Math.log2(rate/skip/lag/440));
    hist[((note%12)+12)%12]+=score;
    detected++;
  }
  const major=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  let best=-Infinity,key=0;
  for(let k=0;k<12;k++){
    let v=0;
    for(let p=0;p<12;p++)v+=hist[p]*major[(p-k+12)%12];
    if(v>best){best=v;key=k;}
  }
  return {key:NAMES[key],bpm:bestTempo,confidence:detected>25?'rough estimate':'low confidence'};
}
export function createMusicEvents(c:Config,duration:number,sourceChords?:Array<{root:number;minor:boolean}>){
  const beat=60/clamp(c.bpm,60,180),bar=4*beat;
  const bars=Math.ceil(duration/bar);
  const progression=PRESETS[c.progression]||PRESETS['1564'];
  const root=Math.max(0,NAMES.indexOf(c.key));
  const events:Event[]=[],chords:string[]=[];
  const add=(part:Part,at:number,span:number,note:number,vol:number,pan=0)=>{
    if(c.parts.includes(part)&&at<duration&&span>0)events.push({part,at,end:Math.min(duration,at+span),note,vol,pan});
  };
  for(let b=0;b<bars;b++){
    const degree=progression[b%4],base=b*bar;
    const suggested=sourceChords?.[b];
    const note=suggested? suggested.root : (root+DEGREES[degree])%12;
    const minor=suggested? suggested.minor : degree===1||degree===2||degree===5;
    const triad=[60+note,60+note+(minor?3:4),67+note];
    chords.push(NAMES[note]+(minor?'m':''));
    const calm=c.genre==='worship'||c.genre==='ballad';
    if(calm){
      for(const n of triad)add('piano',base,bar*.92,n,.21,.06);
      add('piano',base,beat*2,triad[0]-12,.16);
    }else{
      for(const pos of [0,2]){
        for(const n of triad)add('piano',base+pos*beat,beat*1.7,n,.23,.03);
      }
    }
    for(let n=0;n<8;n++){
      if(c.genre==='worship'&&n%2===1)continue;
      const figure=[triad[0]-12,triad[2]-12,triad[0],triad[1],triad[2],triad[1],triad[0],triad[2]-12];
      add('guitar',base+n*.5*beat,beat*.42,figure[n],c.genre==='acoustic'?.21:.12,-.25);
    }
    const bass=36+note;
    add('bass',base,beat*(calm?2.9:.91),bass,.27,-.05);
    add('bass',base+2*beat,beat*.88,calm?bass:bass+7,.18,-.05);
    if(!calm)add('bass',base+3*beat,beat*.7,bass,.17,-.05);
    for(const n of triad)add('strings',base,bar*.98,n+12,c.genre==='worship'?.17:.11,.28);
    const drumGain=c.genre==='acoustic'?.5:calm?.7:1;
    for(const pos of [0,2])add('drums',base+pos*beat,.21,36,.28*drumGain);
    for(const pos of [1,3])add('drums',base+pos*beat,.19,38,.20*drumGain);
    for(let h=0;h<8;h++)if(c.genre!=='acoustic'||h%2===0)add('drums',base+h*beat/2,.07,42,.075*drumGain,.13);
  }
  return {events,chords};
}
type SampleBank=Map<Part,Map<number,AudioBuffer>>;
async function soundfontSamples(events:Event[],status:(msg:string)=>void):Promise<{bank:SampleBank;sampled:string[];synthesized:string[]}>{
  const bank:SampleBank=new Map(),sampled:string[]=[],synthesized:string[]=[];
  const ctx=new AudioContext();
  try {
    const parts=Array.from(new Set(events.filter(e=>e.part!=='drums').map(e=>e.part)));
    await Promise.all(parts.map(async part=>{
      const ac=new AbortController();
      const t=window.setTimeout(()=>ac.abort(),9000);
      try{
        const fontName = PARTS[part]+'-mp3.js';
        const urls = [
          'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/'+fontName,
          'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/FluidR3_GM/'+fontName
        ];
        let text='';
        for(const url of urls){
          try {
            const response=await fetch(url,{signal:ac.signal,cache:'force-cache'});
            if(response.ok){text=await response.text();if(text.length>100)break;}
          }catch{ /* Try the independent sample mirror */ }
        }
        if(!text)throw Error('Sample unavailable from both sources');
        const matches=new Map<number,string>();
        const natural:Record<string,number>={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
        const re=/"([A-G])(#|b)?(\d)"\s*:\s*"(data:audio\/mp3;base64,[^"]+)"/g;
        let m:RegExpExecArray|null;
        while((m=re.exec(text))!==null){
          const note=(Number(m[3])+1)*12+natural[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0);
          matches.set(note,m[4].slice(BYTES.length));
        }
        if(matches.size===0)throw Error('Missing sample map');
        const requested=Array.from(new Set(events.filter(e=>e.part===part).map(e=>e.note)));
        const nearest=new Set<number>();
        for(const note of requested){
          let best=Infinity,closest=0;
          for(const n of matches.keys())if(Math.abs(n-note)<best){best=Math.abs(n-note);closest=n;}
          if(best<=8)nearest.add(closest);
        }
        const targets=Array.from(nearest).slice(0,12);
        const decoded=new Map<number,AudioBuffer>();
        for(const note of targets){
          const encoded=matches.get(note);
          if(!encoded)continue;
          const bin=atob(encoded),bytes=new Uint8Array(bin.length);
          for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
          decoded.set(note,await ctx.decodeAudioData(bytes.buffer));
        }
        if(!decoded.size)throw Error('No playable sample');
        bank.set(part,decoded);sampled.push(part);
      }catch{
        synthesized.push(part);
        status('Instrument sample offline. Using local '+part+' synthesizer.');
      }finally{clearTimeout(t);}
    }));
  }finally{void ctx.close();}
  return {bank,sampled,synthesized};
}
function sampledNote(ctx:OfflineAudioContext,e:Event,offset:number,bank:SampleBank):boolean{
  const map=bank.get(e.part);
  if(!map||map.size===0)return false;
  let near=0,delta=Infinity;
  for(const m of map.keys())if(Math.abs(e.note-m)<delta){delta=Math.abs(e.note-m);near=m;}
  if(delta>8)return false;
  const sample=map.get(near)!;
  const speed=Math.pow(2,(e.note-near)/12);
  const skip=Math.max(0,(offset-e.at)*speed);
  if(skip>=sample.duration-.02)return false;
  const when=Math.max(0,e.at-offset),until=Math.min(ctx.length/ctx.sampleRate,e.end-offset);
  const realEnd=Math.min(until,when+(sample.duration-skip)/speed);
  if(realEnd<=when+.008)return false;
  const source=ctx.createBufferSource(),gain=ctx.createGain(),pan=ctx.createStereoPanner();
  source.buffer=sample;source.playbackRate.value=speed;pan.pan.value=e.pan;
  source.connect(gain);gain.connect(pan);pan.connect(ctx.destination);
  gain.gain.setValueAtTime(.0001,when);
  gain.gain.linearRampToValueAtTime(e.vol,when+.006);
  gain.gain.setValueAtTime(e.vol*.75,Math.max(when+.008,realEnd-.055));
  gain.gain.linearRampToValueAtTime(.0001,realEnd);
  source.start(when,skip);source.stop(realEnd+.005);
  return true;
}
function synthNote(ctx:OfflineAudioContext,e:Event,offset:number){
  const when=Math.max(0,e.at-offset),until=Math.min(ctx.length/ctx.sampleRate,e.end-offset);
  if(until<=when+.007)return;
  const gain=ctx.createGain(),pan=ctx.createStereoPanner(),filter=ctx.createBiquadFilter();
  const freq=440*Math.pow(2,(e.note-69)/12);
  pan.pan.value=e.pan;filter.type='lowpass';
  filter.frequency.value=e.part==='bass'?900:e.part==='strings'?1900:e.part==='guitar'?2700:4000;
  gain.connect(filter);filter.connect(pan);pan.connect(ctx.destination);
  const attack=e.part==='strings'?.18:.01,peak=e.vol*(e.part==='strings'?.72:1);
  gain.gain.setValueAtTime(.0001,when);
  gain.gain.linearRampToValueAtTime(peak,Math.min(until-.004,when+attack));
  gain.gain.setValueAtTime(peak*(e.part==='strings'?.8:.25),Math.max(when+attack,until-.09));
  gain.gain.exponentialRampToValueAtTime(.0001,until);
  for(let i=0;i<3;i++){
    const osc=ctx.createOscillator(),level=ctx.createGain();
    osc.type=e.part==='bass'?'triangle':e.part==='strings'?'sawtooth':e.part==='guitar'?'triangle':'sine';
    osc.frequency.value=freq*(i+1);
    osc.detune.value=i===2?3:-2;
    level.gain.value=i===0?.74:i===1?.18:.07;
    osc.connect(level);level.connect(gain);osc.start(when);osc.stop(until+.005);
  }
}
function noise(rate:number):AudioBuffer{
  const buf=new AudioBuffer({length:Math.floor(rate*.28),numberOfChannels:1,sampleRate:rate});
  const data=buf.getChannelData(0);let s=456231;
  for(let i=0;i<data.length;i++){s=(1664525*s+1013904223)>>>0;data[i]=s/2147483648-1;}
  return buf;
}
function playDrum(ctx:OfflineAudioContext,e:Event,offset:number,noiseSample:AudioBuffer){
  const when=Math.max(0,e.at-offset),len=Math.min(e.end-offset-when,ctx.length/ctx.sampleRate-when);
  if(len<=0)return;
  const envelope=ctx.createGain();
  envelope.gain.setValueAtTime(e.vol*2,when);
  envelope.gain.exponentialRampToValueAtTime(.0001,when+len);
  envelope.connect(ctx.destination);
  if(e.note===36){
    const osc=ctx.createOscillator();osc.type='sine';
    osc.frequency.setValueAtTime(145,when);
    osc.frequency.exponentialRampToValueAtTime(42,when+len);
    osc.connect(envelope);osc.start(when);osc.stop(when+len+.005);
  }else{
    const src=ctx.createBufferSource(),hp=ctx.createBiquadFilter();
    hp.type='highpass';hp.frequency.value=e.note===42?6900:1750;
    src.buffer=noiseSample;src.connect(hp);hp.connect(envelope);
    src.start(when);src.stop(when+len+.005);
  }
}
export async function arrange(voice:Int16Array,rate:number,config:Config,progress:(n:number,message:string)=>void,original?:AudioBuffer):Promise<Outcome>{
  if(voice.length/rate>241)throw Error('The four-minute song limit was exceeded.');
  if(config.bpm<60||config.bpm>180)throw Error('Invalid tempo.');
  const {events,chords}=createMusicEvents(config,voice.length/rate);
  progress(2,'Preparing sampled instruments');
  const library=await soundfontSamples(events,m=>progress(8,m));
  const frames=voice.length,out=new Int16Array(frames*2),size=Math.round(rate*5);
  const hiss=noise(rate),reverbL=new Float32Array(Math.ceil(rate*.052)),reverbR=new Float32Array(Math.ceil(rate*.075));
  const strength=config.strength/100,vocal=config.vocal/100,ambience=config.ambience/100;
  const originalLeft=original && original.numberOfChannels>1 ? original.getChannelData(0) : null;
  const originalRight=original && original.numberOfChannels>1 ? original.getChannelData(1) : null;
  let squared=0, backingSquared=0;
  for(let begin=0;begin<frames;begin+=size){
    const end=Math.min(frames,begin+size);
    const ctx=new OfflineAudioContext(2,end-begin,rate);
    const startSeconds=begin/rate,endSeconds=end/rate;
    for(const e of events){
      if(e.at>=endSeconds||e.end<=startSeconds)continue;
      if(e.part==='drums')playDrum(ctx,e,startSeconds,hiss);
      else if(!sampledNote(ctx,e,startSeconds,library.bank))synthNote(ctx,e,startSeconds);
    }
    const rendered=await ctx.startRendering();
    const left=rendered.getChannelData(0),right=rendered.getChannelData(1);
    for(let i=0;i<end-begin;i++){
      const j=begin+i,v=voice[j]/32768;
      const li=j%reverbL.length,ri=j%reverbR.length;
      const echoL=reverbL[li],echoR=reverbR[ri];
      reverbL[li]=v*.55+echoL*.22;reverbR[ri]=v*.5+echoR*.2;
      backingSquared += (left[i]*left[i]+right[i]*right[i])*.5;
      const duck=1-Math.min(.26,Math.abs(v)*.45);
      const originalSide = originalLeft && originalRight && j<originalLeft.length
        ? (originalLeft[j]-originalRight[j])*.36 : 0;
      const l=(v*vocal+originalSide+echoL*ambience*.3+left[i]*strength*duck)*.9;
      const r=(v*vocal-originalSide+echoR*ambience*.32+right[i]*strength*duck)*.9;
      const a=clamp(Math.tanh(l*1.2)/Math.tanh(1.2),-.96,.96);
      const b=clamp(Math.tanh(r*1.2)/Math.tanh(1.2),-.96,.96);
      out[2*j]=Math.round(a*32767);out[2*j+1]=Math.round(b*32767);
      squared+=(a*a+b*b)/2;
    }
    progress(12+Math.round(88*end/frames),'Arranging '+Math.round(100*end/frames)+'% · '+config.parts.join(' + '));
    await new Promise(resolve=>window.setTimeout(resolve,0));
  }
  const backingRms=Math.sqrt(backingSquared/frames);
  if(backingRms < .00003) throw new Error('Instrument backing was silent; audio export was not marked successful.');
  return {pcm:out,chords,sampled:library.sampled,synthesized:library.synthesized,eventCount:events.length,rms:Math.sqrt(squared/frames),backingRms};
}
export function stereoWav(data:Int16Array,rate:number){
  const bytes=new ArrayBuffer(44+data.length*2),view=new DataView(bytes);
  const write=(i:number,s:string)=>{for(let n=0;n<s.length;n++)view.setUint8(i+n,s.charCodeAt(n));};
  write(0,'RIFF');view.setUint32(4,36+data.length*2,true);write(8,'WAVE');
  write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
  view.setUint16(22,2,true);view.setUint32(24,rate,true);view.setUint32(28,rate*4,true);
  view.setUint16(32,4,true);view.setUint16(34,16,true);
  write(36,'data');view.setUint32(40,data.length*2,true);
  for(let i=0;i<data.length;i++)view.setInt16(44+i*2,data[i],true);
  return new Blob([bytes],{type:'audio/wav'});
}
export function chordNotes(config:Config,chords:string[]){
  return ['HIMIG STUDIO - ACCOMPANIMENT PLAN','Key: '+config.key,'Tempo: '+config.bpm+' BPM',
  'Genre: '+config.genre,'Chord cycle: '+chords.slice(0,4).join(' - '),
  'New instrumental parts: '+config.parts.join(', '),'',
  'IMPORTANT: Generated backing chords are an arrangement proposal, NOT verified original-song transcription.',
  'Adjust the key and tempo until the backing harmonizes with your melody.',
  'Approved lyrics and uploaded vocal are not rewritten.',
  'FluidR3 GM sampled instruments: CC BY 3.0 attribution (gleitz/midi-js-soundfonts); fallback synthesizer when unavailable.'].join('\n');
}
