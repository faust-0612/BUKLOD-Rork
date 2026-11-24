// Original offline environmental tiles. RGB albedo, linear smoothness in alpha, 32-bit TGA.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function makeTile(kind,size){
 const kinds=["soil","grass","stone","paving","timber","metal"];
 if(!kinds.includes(kind)||![1024,2048,4096].includes(size))throw Error("Unsupported tile");
 const out=new Uint8Array(18+size*size*4),dv=new DataView(out.buffer);
 out[2]=2;dv.setUint16(12,size,true);dv.setUint16(14,size,true);out[16]=32;out[17]=0x28;
 const tau=Math.PI*2, waves={soil:[17,31,67],grass:[41,71,113],stone:[13,23,59],paving:[11,37,83],timber:[47,91,137],metal:[89,149,223]}[kind];
 const [a,b,c]=waves;
 const axis=Array.from({length:3},(_,i)=>Float32Array.from({length:size},(_,k)=>Math.sin(tau*waves[i]*k/size)));
 const clamp=x=>Math.max(0,Math.min(255,Math.round(x)));
 const smooth={soil:.16,grass:.20,stone:.25,paving:.32,timber:.24,metal:.62}[kind];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const xx=x/size,yy=y/size;
  let detail=.42*axis[0][x]*axis[1][y]+.28*axis[1][x]*axis[0][y]+.17*axis[2][x]*axis[2][y];
  if(kind==="paving"){
   const row=Math.floor(yy*8),u=(xx*4+(row%2)*.5)%1,v=(yy*8)%1;
   const edge=Math.min(u,1-u,v,1-v);
   detail=detail*.36-.55*Math.max(0,1-edge/.036);
  }else if(kind==="timber")detail=.55*axis[0][x]+.24*axis[1][x]*axis[0][y]+.12*axis[2][x];
  else if(kind==="metal")detail=.50*axis[2][x]+.15*axis[1][x]*axis[0][y];
  else if(kind==="grass")detail+=.18*axis[2][x];
  const value=clamp(220+43*detail),k=18+(y*size+x)*4;
  out[k]=value;out[k+1]=value;out[k+2]=value;out[k+3]=clamp(255*(smooth+.10*detail));
 }
 return out;
}
const size=Number(process.argv[2]||2048),out=new URL('./ReviewOutput/environment-materials/',import.meta.url);
mkdirSync(out,{recursive:true});
const textures=["soil","grass","stone","paving","timber","metal"].map(kind=>{const bytes=makeTile(kind,size),file=kind+'.tga';writeFileSync(new URL(file,out),bytes);return {file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});
writeFileSync(new URL('manifest.json',out),JSON.stringify({status:'REVIEW_ONLY',resolution:size,textures},null,2)+'\n');
