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
    for(let j=i*step;j<Math.min(end,(i+1)*step);j+=12)total+=Math.abs(data[¶»§q«^