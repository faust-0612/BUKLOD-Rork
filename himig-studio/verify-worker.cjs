const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const code=fs.readFileSync('dist/audio-worker.js','utf8');
async function check(seconds=8){
 const rate=11025, samples=new Float32Array(Math.round(rate*seconds));
 for(let i=0;i<samples.length;i++)samples[i]=.22*Math.sin(2*Math.PI*220*i/rate);
 let progressCount=0;
 return await new Promise((resolve,reject)=>{
  const scope={postMessage(m){if(m.type==='progress')progressCount++;if(m.type==='error')reject(Error(m.message));if(m.type==='quality_rejected')resolve({m,progressCount,rejected:true});if(m.type==='complete')resolve({m,progressCount,rejected:false})}};
  const context={self:scope,Math,Array,Number,Float32Array,Int16Array,Uint16Array,Float64Array,Map,Set,Error,Promise,setTimeout,clearTimeout,console};
  vm.runInNewContext(code,context);
  scope.onmessage({data:{type:'render',mono:samples,sampleRate:rate,config:{key:'C',bpm:100,genre:'modern-pop',progression:'1564',parts:['piano','guitar','bass','strings','drums'],strength:65,vocal:95,ambience:18},mode:'polish',gain:1.1,backingLevel:0}});
 }).then(({m,progressCount,rejected})=>{
  assert.ok(progressCount>0);
  if(rejected){
    assert.equal(m.report.decision,'REJECT');
    assert.equal(m.report.fallback,'original-recording');
    console.log(JSON.stringify({seconds,decision:'REJECT',fallback:m.report.fallback,metrics:m.report.measurements,progressEvents:progressCount}));
  } else {
    assert.equal(m.stereo.length,rate*seconds*2);assert.ok(m.result.backingRms>.00003);
    assert.ok(m.result.quality);
    assert.equal(m.result.quality.decision,'REVIEW_REQUIRED');
    assert.equal(m.result.quality.checks.find(x=>x.name.includes('Whisper')).status,'NOT_MEASURED');
    console.log(JSON.stringify({seconds,frames:m.stereo.length/2,eventCount:m.result.eventCount,backingRms:m.result.backingRms,decision:m.result.quality.decision,progressEvents:progressCount}));
  }
 });
}
(async()=>{await check(8);await check(231);console.log('WORKER_FULL_LENGTH_MEASUREMENT_COMPLETED_NOT_MUSICAL_APPROVAL')})().catch(e=>{console.error(e);process.exit(1)});

