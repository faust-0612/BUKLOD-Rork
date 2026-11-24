// Deterministic premium border geometry, original assets only; Node 18+.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function premiumEnvironment(input){
 const dv=new DataView(input.buffer,input.byteOffset,input.byteLength),n=dv.getUint32(12,true);
 if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==input.length||dv.getUint32(16,true)!==0x4e4f534a)throw Error("Invalid source GLB");
 const doc=JSON.parse(String.fromCharCode(...input.slice(20,20+n))),old=input.slice(28+n);
 if(dv.getUint32(24+n,true)!==0x004e4942||dv.getUint32(20+n,true)!==old.length||doc.buffers[0].byteLength!==old.length||doc.meshes.length!==5||doc.extras.revision!=="original arena environment v3")throw Error("Expected v3 map");
 const chunks=[old];let offset=old.length;
 function append(a){if(offset%4)throw Error("Unaligned buffer");let i=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:a.length,target:34962});chunks.push(a);offset+=a.length;return i;}
 function acc(arr,k){let f=new Float32Array(arr),v=append(new Uint8Array(f.buffer)),a={bufferView:v,componentType:5126,count:f.length/k,type:"VEC"+k};if(k===3){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<f.length;i++){a.min[i%3]=Math.min(a.min[i%3],f[i]);a.max[i%3]=Math.max(a.max[i%3],f[i]);}}doc.accessors.push(a);return doc.accessors.length-1;}
 const groups=new Map(),tau=2*Math.PI;
 const seed=(a,b)=>{let t=Math.imul(a+43,374761393)^Math.imul(b+97,668265263);t=Math.imul(t^(t>>>13),1274126177);return ((t^(t>>>16))>>>0)/4294967295;};
 const materials={};
 for(const [name,original,factor] of [["cliff_slate","stone",[.30,.37,.41,1]],["cliff_moss","stone",[.21,.31,.23,1]],["cedar_bark","wood",[.24,.16,.09,1]],["cedar_dark","foliage",[.08,.27,.14,1]],["cedar_light","foliage",[.18,.39,.19,1]]]){
  let m=doc.materials.find(x=>x.name===original);if(!m)throw Error("Missing material "+original);
  materials[name]=doc.materials.length;doc.materials.push({...m,name,pbrMetallicRoughness:{...m.pbrMetallicRoughness,baseColorFactor:factor}});
 }
 materials.rift_cascade=doc.materials.length;doc.materials.push({name:"rift_cascade",doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[.17,.55,.68,1],metallicFactor:.10,roughnessFactor:.32}});
 let triangles=0;
 function triangle(name,a,b,c){
  let cross=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])],l=Math.hypot(...cross);
  if(l<1e-7)return;
  const norm=cross.map(x=>x/l);const axis=norm.map(Math.abs).indexOf(Math.max(...norm.map(Math.abs))),axes=[0,1,2].filter(k=>k!==axis);
  if(!groups.has(name))groups.set(name,{p:[],n:[],uv:[]});const g=groups.get(name);
  for(const q of [a,b,c]){
   if(q.some(x=>!Number.isFinite(x))||q[0]<0||q[0]>320||q[1]<0||q[1]>10||q[2]<0||q[2]>220||!(q[2]<=12||q[2]>=208))throw Error("Decoration escaped border envelope");
   g.p.push(...q);g.n.push(...norm);g.uv.push(q[axes[0]]*.45,q[axes[1]]*.45);
  }
  triangles++;
 }
 function loft(name,x,z,y,rings,segments,serial,rough=.14){
  const pts=rings.map(([h,rx,rz],j)=>Array.from({length:segments},(_,i)=>{const a=tau*i/segments,noise=1+rough*(2*seed(serial+i,j)-1);return [x+Math.cos(a)*rx*noise,y+h,z+Math.sin(a)*rz*noise];}));
  for(let j=0;j<pts.length-1;j++)for(let i=0;i<segments;i++){const k=(i+1)%segments,a=pts[j][i],b=pts[j+1][i],c=pts[j+1][k],d=pts[j][k];triangle(name,a,b,c);triangle(name,a,c,d);}
  const j=pts.length-1;for(let i=0;i<segments;i++)triangle(name,[x,y+rings[j][0],z],pts[j][(i+1)%segments],pts[j][i]);
 }
 let rocks=0,trees=0,cascades=0;
 for(let side=0;side<2;side++)for(let i=0;i<26;i++){
  let x=7+i*12.2,z=side?214.7:5.3;
  if(Math.abs(x-160)<16)continue;
  const serial=side*100+i,h=1.3+2.2*seed(serial,3),r=1.1+1.25*seed(serial,4);
  loft(i%3===0?"cliff_moss":"cliff_slate",x,z,.02,[[0,r,r*.7],[h*.37,r*.95,r*.65],[h*.78,r*.62,r*.5],[h,.25*r,.19*r]],10,serial,.25);rocks++;
  if(i%2===0){
   x+=3.2;z=side?211.2:8.8;
   const tall=4.1+1.3*seed(serial,9);
   loft("cedar_bark",x,z,0,[[0,.22,.22],[tall*.83,.10,.10]],8,serial);
   for(let k=0;k<3;k++){
    const radius=(1.75-.36*k)*(1+.12*seed(serial,k+13)),y=tall*(.24+.20*k);
    loft(k===2?"cedar_light":"cedar_dark",x,z,y,[[0,radius*.55,radius*.55],[.30,radius,radius],[tall*.32,radius*.19,radius*.19],[tall*.40,.06,.06]],12,serial+k*100,.18);
   }
   trees++;
  }
 }
 // Two small decorative cascades at the river termini, outside every playable lane.
 for(const z of [3,217]){
  const dir=z<110?1:-1;
  for(let i=0;i<12;i++){
   const x=156+i*8/12,next=156+(i+1)*8/12,top=4.3+.15*Math.sin(i*.8),topNext=4.3+.15*Math.sin((i+1)*.8);
   const a=[x,top,z],b=[next,topNext,z],c=[next,.10,z+dir*2.2],d=[x,.10,z+dir*2.2];
   triangle("rift_cascade",a,b,c);triangle("rift_cascade",a,c,d);
  }
  for(const x of [154,166])loft("cliff_slate",x,z,0,[[0,1.2,1.1],[3.7,1.1,.9],[4.7,.6,.5]],10,x+z,.18);
  cascades++;
 }
 if(triangles>16000||trees===0||rocks===0||cascades!==2)throw Error("Unexpected geometry budget or coverage");
 const primitives=[];
 for(const [name,g] of groups)primitives.push({mode:4,material:materials[name],attributes:{POSITION:acc(g.p,3),NORMAL:acc(g.n,3),TEXCOORD_0:acc(g.uv,2)}});
 doc.meshes.push({name:"GenesisRift_premium_border",primitives});
 doc.nodes.push({name:"GenesisRift_premium_border",mesh:doc.meshes.length-1});doc.scenes[0].nodes.push(doc.nodes.length-1);
 doc.extras={...doc.extras,revision:"original arena environment v4",reviewOnly:true,collisionChange:false,premiumBorder:{rocks,trees,cascades,triangles}};
 doc.buffers[0].byteLength=offset;
 const j=JSON.stringify(doc),len=j.length+(4-j.length%4)%4,out=new Uint8Array(28+len+offset),d=new DataView(out.buffer);
 d.setUint32(0,0x46546c67,true);d.setUint32(4,2,true);d.setUint32(8,out.length,true);d.setUint32(12,len,true);d.setUint32(16,0x4e4f534a,true);
 for(let i=0;i<len;i++)out[20+i]=i<j.length?j.charCodeAt(i):32;
 d.setUint32(20+len,offset,true);d.setUint32(24+len,0x004e4942,true);let pos=28+len;
 for(const a of chunks){out.set(a,pos);pos+=a.length;}if(pos!==out.length)throw Error("Length mismatch");
 return {bytes:out,rocks,trees,cascades,triangles,sourceBinaryBytes:old.length};
}
const source=new URL('./AssetCandidates/genesis_rift_environment_review.glb',import.meta.url);
const out=new URL('./ReviewOutput/environment/',import.meta.url);
const input=readFileSync(source);const r=premiumEnvironment(input);mkdirSync(out,{recursive:true});
writeFileSync(new URL('genesis_rift_premium_review.glb',out),r.bytes);
const {bytes,...stats}=r;writeFileSync(new URL('manifest.json',out),JSON.stringify({...stats,status:'REVIEW_ONLY',sourceSha256:createHash('sha256').update(input).digest('hex'),sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length},null,2)+'\n');
console.log(stats,bytes.length);
