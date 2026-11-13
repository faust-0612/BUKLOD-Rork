const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const path=require('node:path');
// Compile the exact production TypeScript source; no mock of measurePcm.
const code=fs.readFileSync(path.join(__dirname,'../src/qualityGate.ts'),'utf8');
const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const moduleHolder={exports:{}};
new Function('module','exports','require',js)(moduleHolder,moduleHolder.exports,require);
const {measurePcm}=moduleHolder.exports;
function makeSine(seconds=2,amp=.2,rate=44100){
 const pcm=new Int16Array(Math.round(rate*seconds)*2);
 for(let i=0;i<pcm.length/2;i++){
  const sample=Math.round(Math.sin(2*Math.PI*220*i/rate)*amp*32767);
  pcm[i*2]=sample;pcm[i*2+1]=sample;
 }
 return pcm;
}
test('QC measures non-silent 2-second stereo waveform and stays honest about ASR',()=>{
 const report=measurePcm(makeSine(),44100,'mix');
 assert.equal(report.schema,'himig-qc-v1');
 assert.equal(report.decision,'REVIEW_REQUIRED');
 assert.equal(report.fallback,'original-recording');
 assert.equal(report.measurements.clippedSampleCount,0);
 assert.ok(report.measurements.integratedLufs < -5 && report.measurements.integratedLufs > -30);
 assert.ok(report.measurements.stereoCorrelation > .999);
 assert.equal(report.measurements.truePeakDbTp,null);
 assert.equal(report.checks.find(x=>x.name.includes('Whisper')).status,'NOT_MEASURED');
 assert.equal(report.checks.find(x=>x.name.includes('Pitch drift')).status,'NOT_MEASURED');
 assert.equal(report.checks.find(x=>x.name.includes('Stem separation')).status,'NOT_MEASURED');
});
test('QC blocks silent signal rather than declaring done',()=>{
 const q=measurePcm(new Int16Array(44100*2),44100);
 assert.equal(q.decision,'REJECT');
 assert.equal(q.measurements.integratedLufs,null);
 assert.ok(q.checks.some(x=>x.status==='FAIL'));
});
test('QC rejects digital clipping even if loud enough',()=>{
 const x=makeSine(1,.3);
 x[123]=32767;
 const q=measurePcm(x,44100);
 assert.equal(q.decision,'REJECT');
 assert.ok(q.measurements.clippedSampleCount>=1);
 assert.equal(q.checks.find(x=>x.name==='Digital sample clipping').status,'FAIL');
});
test('Production source must reject failed mix and offer original fallback',()=>{
 const worker=fs.readFileSync(path.join(__dirname,'../src/songWorker.ts'),'utf8');
 const app=fs.readFileSync(path.join(__dirname,'../src/App.tsx'),'utf8');
 assert.ok(worker.includes('measurePcm(stereo, rate, stage)'));
 assert.ok(worker.includes("type:'quality_rejected'"));
 assert.ok(app.includes("setQualityRejection(true)"));
 assert.ok(app.includes("Fallback: untouched original recording"));
 assert.ok(app.includes("source-cleanup-NOT-vocal-stem"));
 assert.ok(app.includes("synth-backing-NOT-real-instruments"));
 assert.ok(!app.includes("Finish studio master"));
});
test('Five owned-song real audio acceptance is NOT falsely marked passed',()=>{
 const x=JSON.parse(fs.readFileSync(path.join(__dirname,'../reports/real-song-acceptance.json'),'utf8'));
 assert.equal(x.required_consent_owned_songs,5);
 assert.equal(x.verified_real_source_songs,0);
 assert.equal(x.overall,'BLOCKED_FOR_STUDIO_QUALITY');
 assert.equal(x.known_bad_outputs[0].final_audio_quality,'REJECTED_BY_OWNER');
});
