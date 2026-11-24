// Original faction architecture detail generation; Node 18+, no dependencies.
import {readFileSync,writeFileSync} from 'node:fs';
function enrich(bytes,id){
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=dv.getUint32(12,true);if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==bytes.length||dv.getUint32(16,true)!==0x4e4f534a)throw Error("Bad GLB");let s="";for(let i=20;i<20+n;i++)s+=String.fromCharCode(bytes[i]);const g=JSON.parse(s),old=bytes.slice(28+n);if(dv.getUint32(24+n,true)!==0x004e4942||dv.getUint32(20+n,true)!==old.length||g.buffers[0].byteLength!==old.length||g.meshes.length!==1||g.nodes[0].name!==id)throw Error("Unexpected structure");
 const lux=id.startsWith("lux"),tower=id.endsWith("tower"),metal=lux?6:9,trim=lux?8:10,glow=lux?11:12,cloth=lux?7:10;
 const groups=new Map(),features={ribs:0,arches:0,facets:0,inlays:0};const radius=tower?2.6:3.5,maxY=tower?8.55:5.8;
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>mul(a,1/Math.hypot(...a));
 function tri(m,a,b,c,center){let normal=cross(sub(b,a),sub(c,a)),l=Math.hypot(...normal);if(l<1e-8)throw Error("Degenerate triangle");if(dot(normal,sub(mul(add(add(a,b),c),1/3),center))<0){[b,c]=[c,b];normal=mul(normal,-1)}normal=mul(normal,1/l);let q=groups.get(m);if(!q){q={p:[],n:[]};groups.set(m,q)}for(const v of [a,b,c]){if(v.some(x=>!Number.isFinite(x))||Math.hypot(v[0],v[2])>radius+.0001||v[1]<0||v[1]>maxY+.0001)throw Error("Outside original envelope "+id+" "+v);q.p.push(...v);q.n.push(...normal)}}
 function beam(m,a,b,r1,r2,segments=6){const dir=norm(sub(b,a)),side=norm(cross(dir,Math.abs(dir[1])>.95?[1,0,0]:[0,1,0])),up=cross(dir,side),c=mul(add(a,b),.5),ring=(p,r)=>Array.from({length:segments},(_,i)=>add(p,add(mul(side,r*Math.cos(i*2*Math.PI/segments)),mul(up,r*Math.sin(i*2*Math.PI/segments))))),x=ring(a,r1),y=ring(b,r2);for(let i=0;i<segments;i++){let j=(i+1)%segments;tri(m,x[i],x[j],y[j],c);tri(m,x[i],y[j],y[i],c);tri(m,a,x[j],x[i],c);tri(m,b,y[i],y[j],c)}}
 function radial(a,r,y){return [Math.cos(a)*r,y,Math.sin(a)*r]}
 function ring(m,r,y,w,segments=32){for(let i=0;i<segments;i++){let a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;beam(m,radial(a,r,y),radial(b,r,y),w,w,4)}}
 function gem(a,r,y,h,w){const center=radial(a,r,y),lo=add(center,[0,-h/2,0]),hi=add(center,[0,h/2,0]);beam(glow,lo,center,.015,w,6);beam(glow,center,hi,w,.015,6);features.facets++}
 if(tower){
  for(const y of [.24,.59,1.38,4.83,5.76])ring(y<1?1:trim,y<1?2.37:y<2?1.67:1.52,y,.045,lux?36:24);
  for(let i=0;i<(lux?8:6);i++){let a=i*2*Math.PI/(lux?8:6);
   beam(metal,radial(a,2.15,.65),radial(a,1.16,3.4),lux?.17:.25,.09,6);
   beam(trim,radial(a,1.94,.9),radial(a,1.17,3.1),.038,.032,5);features.ribs++;
   if(lux){let a1=a-.18,a2=a+.18;const crown=radial(a,1.29,5.42);beam(trim,radial(a1,1.28,3.65),crown,.07,.045);beam(trim,crown,radial(a2,1.28,3.65),.045,.07);features.arches++;}
   else{beam(metal,radial(a,1.4,4.1),radial(a,2.14,5.9),.20,.025,5);beam(trim,radial(a,1.65,5.08),radial(a,2.02,5.55),.055,.026,5);features.arches++;}
   gem(a,lux?1.32:1.46,2.5,.58,.085);
   beam(cloth,radial(a,1.44,4.68),radial(a,1.33,3.79),.075,.055,4);features.inlays++;
  }
  ring(trim,.95,6.94,.065,32);ring(trim,.68,7.75,.045,24);
 } else {
  for(const y of [.22,.66,1.22,1.5])ring(y<1?1:trim,y<1?3.21:2.53,y,.05,lux?40:30);
  for(let i=0;i<(lux?8:6);i++){let a=i*2*Math.PI/(lux?8:6);
   beam(metal,radial(a,3.04,.9),radial(a,lux?2.4:2.85,2.4),lux?.15:.24,.12);features.ribs++;
   let top=radial(a,lux?1.65:2.08,lux?4.66:4.28);
   beam(trim,radial(a,2.55,2.35),top,.095,.055);
   beam(metal,top,radial(a,lux?1.34:2.6,lux?5.22:4.8),.09,.025,5);features.arches++;
   gem(a,2.52,1.75,.78,.12);beam(cloth,radial(a,2.95,1.02),radial(a,2.75,1.48),.10,.06,4);features.inlays++;
  }
  ring(trim,1.86,3.5,.055,40);ring(trim,1.44,4.25,.042,32);
 }
 const chunks=[old];let offset=old.length;function acc(arr){const f=new Float32Array(arr),a=new Uint8Array(f.buffer),v=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:a.length,target:34962});offset+=a.length;chunks.push(a);const q={bufferView:v,componentType:5126,count:arr.length/3,type:"VEC3",min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(let i=0;i<f.length;i++){let k=i%3;q.min[k]=Math.min(q.min[k],f[i]);q.max[k]=Math.max(q.max[k],f[i])}g.accessors.push(q);return g.accessors.length-1;}
 let triangles=0;for(const [m,q] of groups){g.meshes[0].primitives.push({attributes:{POSITION:acc(q.p),NORMAL:acc(q.n)},material:m,mode:4});triangles+=q.p.length/9}
 if(triangles>18000)throw Error("Structure detail budget");g.buffers[0].byteLength=offset;g.extras={...g.extras,reviewOnly:true,revision:"faction architecture v2",features};const json=JSON.stringify(g),j=json.length+(4-json.length%4)%4,out=new Uint8Array(28+j+offset),d=new DataView(out.buffer);d.setUint32(0,0x46546c67,true);d.setUint32(4,2,true);d.setUint32(8,out.length,true);d.setUint32(12,j,true);d.setUint32(16,0x4e4f534a,true);for(let i=0;i<j;i++)out[20+i]=i<json.length?json.charCodeAt(i):32;d.setUint32(20+j,offset,true);d.setUint32(24+j,0x004e4942,true);let cur=28+j;for(const q of chunks){out.set(q,cur);cur+=q.length}if(cur!==out.length||!old.every((v,i)=>out[28+j+i]===v))throw Error("Buffer mismatch");return {bytes:out,triangles,features};
}
for(const id of ["lux_tower","lux_core","tenebra_tower","tenebra_core"]){const a=enrich(readFileSync(new URL('./AssetCandidates/'+id+'_candidate.glb',import.meta.url)),id);writeFileSync(new URL('./AssetCandidates/'+id+'_architecture_review.glb',import.meta.url),a.bytes);console.log(id,a.triangles,a.features);}
