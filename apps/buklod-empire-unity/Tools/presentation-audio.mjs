// Original synthesized music and creature audio; no sample libraries or network.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function scoreBank(){
 const rate=22050, tau=2*Math.PI;
 const names=["menu","battle","ambience","victory","defeat","draw","entrance",...Array.from({length:9},(_,i)=>"creature_attack_"+i),...Array.from({length:9},(_,i)=>"creature_defeat_"+i)];
 const lengths=[16,16,12,4,4,3,1.4,...Array(9).fill(.8),...Array(9).fill(1.3)];
 const chord=[[0,3,7],[8,12,15],[5,8,12],[7,10,14]];
 const hz=n=>130.8128*Math.pow(2,n/12);
 return names.map((name,index)=>{
  const n=Math.round(rate*lengths[index]),pcm=new Int16Array(n);let noise=0,seed=(0x7af32b1+index*10213)>>>0,peak=0,sum=0;
  for(let i=0;i<n;i++){
   const t=i/rate,cycle=i/n;seed=(Math.imul(seed,1664525)+1013904223)>>>0;noise=noise*.97+((seed/4294967296)*2-1)*.03;
   let value=0;
   if(index<2){
    const beat=t/(index===0?.5:.4),bar=Math.floor(beat/8)%4,phase=beat%1;
    const ch=chord[bar],env=Math.min(1,phase*35)*Math.exp(-phase*3);
    const note=hz(ch[Math.floor(beat)%3]+(index===0?12:0));
    value=.14*env*(Math.sin(tau*note*t)+.23*Math.sin(tau*note*2*t));
    for(const k of ch)value+=.036*Math.sin(tau*hz(k)*t)*Math.sin(Math.PI*(beat%8)/8)**2;
    if(index===1){const kick=(beat%2)/2;value+=.19*Math.sin(tau*(45*kick+.7*(1-Math.exp(-kick*28))))*Math.exp(-kick*15)*Math.min(1,kick*150);value+=.13*noise*Math.exp(-phase*6);}
   }else if(index===2){
    value=.48*noise*(.7+.2*Math.sin(tau*cycle*3))+.025*Math.sin(tau*cycle*48)*Math.sin(tau*cycle*2)**2;
   }else if(index<=6){
    const notes=index===3?[0,7,12,16,19]:index===4?[12,10,7,3,0]:index===5?[0,5,7,5]:[0,7,12];
    const pos=cycle*notes.length,k=Math.min(notes.length-1,Math.floor(pos)),q=pos%1,f=hz(notes[k]+12);
    value=.24*Math.min(1,q*16)*Math.exp(-q*2)*(Math.sin(tau*f*t)+.22*Math.sin(tau*f*2*t))+.07*noise;
   }else{
    const species=(index-7)%9,death=index>=16,env=Math.min(1,t*35)*Math.pow(1-cycle,1.5),f=([210,88,320,145,48,185,440,65,38][species])*(death?0.75:1);
    const phase=tau*f*(t-(death?.28:.10)*t*cycle)+.8*Math.sin(tau*(species+3)*t);
    value=env*(.23*Math.sin(phase)+.085*Math.sin(phase*2.07)+.21*noise*(species===2||species===6?2:1));
   }
   const fade=Math.min(1,i/(rate*.025),(n-1-i)/(rate*.05));value*=fade;
   const sample=Math.round(Math.max(-.95,Math.min(.95,value))*32767);pcm[i]=sample;peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;
  }
  const bytes=new Uint8Array(44+n*2),v=new DataView(bytes.buffer);for(const [off,str] of [[0,"RIFF"],[8,"WAVE"],[12,"fmt "],[36,"data"]])for(let j=0;j<str.length;j++)bytes[off+j]=str.charCodeAt(j);v.setUint32(4,bytes.length-8,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,n*2,true);for(let j=0;j<n;j++)v.setInt16(44+j*2,pcm[j],true);
  return {name,bytes,samples:n,peak,rms:Math.sqrt(sum/n)};
 });
}
const out=new URL('./ReviewOutput/presentation-audio/',import.meta.url);mkdirSync(out,{recursive:true});
const clips=scoreBank().map(({name,bytes,samples})=>{const file=name+'.wav';writeFileSync(new URL(file,out),bytes);return {name,file,bytes:bytes.length,samples,sha256:createHash('sha256').update(bytes).digest('hex')}});
writeFileSync(new URL('manifest.json',out),JSON.stringify({status:'REVIEW_ONLY',rate:22050,clips},null,2)+'\n');
