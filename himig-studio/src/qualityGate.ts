/**
 * Himig Studio QC v0.3 - measured DSP checks ONLY.
 * This module does NOT claim to perform stem separation, ASR, vocal pitch tracking or
 * listening-quality validation. Unknown means UNKNOWN, not PASS.
 */
export type GateStatus = 'PASS' | 'FAIL' | 'NOT_MEASURED';
export type QcDecision = 'REJECT' | 'REVIEW_REQUIRED';
export type QcCheck = { name: string; status: GateStatus; value: number | string | null; unit?: string; reason: string };
export type QcReport = {
  schema: 'himig-qc-v1'; stage: string; decision: QcDecision;
  sampleRate: number; durationSeconds: number;
  measurements: {
    samplePeakDbFs: number; rmsDbFs: number; integratedLufs: number | null;
    clippedSampleCount: number; nonFiniteCount: number;
    truePeakDbTp: null; stereoCorrelation: number | null;
  };
  checks: QcCheck[];
  verdictReasons: string[];
  fallback: 'original-recording';
  exactMelodyPreserved: 'NOT_MEASURED';
  originalVocalSeparated: false;
  producedBy: 'browser-oscillator-prototype';
};
const db = (amp: number) => amp > 0 ? 20 * Math.log10(amp) : -120;
type Coeff = [number, number, number, number, number];
function highPass(rate: number): Coeff {
  const w = 2 * Math.PI * 38.13547087602444 / rate;
  const c = Math.cos(w); const a = Math.sin(w)/(2 * 0.5003270373238773);
  const d = 1 + a;
  return [((1+c)/2)/d, (-(1+c))/d, ((1+c)/2)/d, -2*c/d, (1-a)/d];
}
function highShelf(rate: number): Coeff {
  const A = Math.pow(10, 4 / 40);
  const w = 2*Math.PI*1681.974450955533/rate, c = Math.cos(w);
  const alpha = Math.sin(w)/Math.SQRT2;
  const d = (A+1)-(A-1)*c+2*Math.sqrt(A)*alpha;
  return [
    A*((A+1)+(A-1)*c+2*Math.sqrt(A)*alpha)/d,
    -2*A*((A-1)+(A+1)*c)/d,
    A*((A+1)+(A-1)*c-2*Math.sqrt(A)*alpha)/d,
    2*((A-1)-(A+1)*c)/d,
    ((A+1)-(A-1)*c-2*Math.sqrt(A)*alpha)/d
  ];
}
class Biquad {
  private z1=0; private z2=0;
  constructor(private c: Coeff){}
  tick(x: number): number {
    const [b0,b1,b2,a1,a2] = this.c;
    const y = b0*x+this.z1;
    this.z1 = b1*x-a1*y+this.z2;
    this.z2 = b2*x-a2*y;
    return y;
  }
}
/** ITU-R BS.1770 / EBU-style 400ms, 100ms hop, absolute/relative gate.
 * Browser-side calculation is informative; true peak requires proper oversampling and
 * therefore remains NOT_MEASURED. Sanity thresholds are configurable policy, not proof of art.
 */
export function measurePcm(pcm: Int16Array, rate: number, stage='mix'): QcReport {
  if(!Number.isInteger(rate)||rate<8000||rate>192000||pcm.length<2||pcm.length%2)
    throw new Error('Invalid interleaved stereo PCM');
  const frames=pcm.length/2;
  const filters = [
    [new Biquad(highShelf(rate)), new Biquad(highPass(rate))],
    [new Biquad(highShelf(rate)), new Biquad(highPass(rate))]
  ];
  let peak=0, total=0, sumL=0,sumR=0, sumLL=0,sumRR=0,sumLR=0, clipped=0, nonFinite=0;
  const windowSize=Math.max(1,Math.round(rate*.4));
  const hop=Math.max(1,Math.round(rate*.1));
  const ring=new Float64Array(windowSize);
  const blocks:number[]=[];
  let windowEnergy=0;
  for(let i=0;i<frames;i++){
    let weighted=0; let rawLeft=0;
    for(let ch=0;ch<2;ch++){
      const raw=pcm[i*2+ch]/32768;
      if(!Number.isFinite(raw))nonFinite++;
      const x=Number.isFinite(raw)?raw:0;
      const abs=Math.abs(x); if(abs>peak)peak=abs;
      if(abs>=.999)clipped++;
      total+=x*x;
      if(ch===0){sumL+=x;sumLL+=x*x;rawLeft=x;} else {sumR+=x;sumRR+=x*x;}
      // stereo covariance computed from original, not K-weighted samples
      if(ch===1)sumLR+=rawLeft*x;
      const q=filters[ch][1].tick(filters[ch][0].tick(x));
      if(ch===0)weighted=q*q;
      else weighted+=q*q;
    }
    const pos=i%windowSize;
    windowEnergy+=weighted-ring[pos]; ring[pos]=weighted;
    if(i+1>=windowSize && ((i+1-windowSize)%hop===0))
      blocks.push(Math.max(0,windowEnergy/windowSize));
  }
  const absoluteGate=Math.pow(10,(-70+0.691)/10);
  const abs=blocks.filter(v=>v>absoluteGate);
  let integratedLufs:number|null=null;
  if(abs.length){
    const mean=abs.reduce((a,b)=>a+b,0)/abs.length;
    const relative=mean/10; // 10 LU relative gate
    const gated=abs.filter(v=>v>relative);
    if(gated.length){
      const energy=gated.reduce((a,b)=>a+b,0)/gated.length;
      integratedLufs=-0.691+10*Math.log10(energy);
    }
  }
  const lufs=integratedLufs===null?null:Math.round(integratedLufs*100)/100;
  const peakDb=Math.round(db(peak)*100)/100;
  const rms=Math.round(db(Math.sqrt(total/pcm.length))*100)/100;
  const meanL=sumL/frames,meanR=sumR/frames;
  const cov=sumLR/frames-meanL*meanR;
  const vl=sumLL/frames-meanL*meanL, vr=sumRR/frames-meanR*meanR;
  const stereoCorrelation=vl>0&&vr>0?Math.round(cov/Math.sqrt(vl*vr)*10000)/10000:null;
  const checks: QcCheck[]=[
    {name:'Digital sample clipping',status:clipped===0?'PASS':'FAIL',value:clipped,unit:'samples',reason:'Any sample at >=99.9% full scale is rejected'},
    {name:'Finite audio samples',status:nonFinite===0?'PASS':'FAIL',value:nonFinite,unit:'samples',reason:'NaN/Infinity are prohibited'},
    {name:'Measured integrated loudness',status:lufs!==null&&lufs>=-26&&lufs<=-8?'PASS':'FAIL',value:lufs,unit:'LUFS',reason:'Prototype safety range -26 to -8 LUFS; musical approval requires listening'},
    {name:'Output sample peak',status:peakDb<=-.1?'PASS':'FAIL',value:peakDb,unit:'dBFS',reason:'Sample peak <= -0.1 dBFS; true peak is not measured'},
    {name:'True peak',status:'NOT_MEASURED',value:null,unit:'dBTP',reason:'Needs oversampled intersample peak measurement'},
    {name:'Pitch drift vs original singing',status:'NOT_MEASURED',value:null,unit:'cents',reason:'No original isolated singing-F0 stem or time alignment available'},
    {name:'Lyrics word-match (Whisper)',status:'NOT_MEASURED',value:null,unit:'%',reason:'No ASR/forced-alignment backend configured; lyric text is not speech validation'},
    {name:'Stem separation and artifact audit',status:'NOT_MEASURED',value:null,reason:'Demucs/BS-Roformer have not been deployed; original voice is not isolated'},
    {name:'Human listening / Android export',status:'NOT_MEASURED',value:null,reason:'Requires manual review on a physical Android device'}
  ];
  const failed=checks.filter(c=>c.status==='FAIL');
  return {
    schema:'himig-qc-v1',stage,decision:failed.length?'REJECT':'REVIEW_REQUIRED',
    sampleRate:rate,durationSeconds:Math.round(100*frames/rate)/100,
    measurements:{samplePeakDbFs:peakDb,rmsDbFs:rms,integratedLufs:lufs,
      clippedSampleCount:clipped,nonFiniteCount:nonFinite,truePeakDbTp:null,stereoCorrelation},
    checks,verdictReasons:failed.length?failed.map(c=>c.name+' failed'):['Automated checks incomplete; manual listening and missing model stages required'],
    fallback:'original-recording',exactMelodyPreserved:'NOT_MEASURED',originalVocalSeparated:false,producedBy:'browser-oscillator-prototype'
  };
}
