// Original zero-purchase arena detailing. Node 18+; no dependencies.
import {readFileSync,writeFileSync} from 'node:fs';
function enrichArena(bytes){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=d.getUint32(12,true);if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==bytes.length||d.getUint32(16,true)!==0x4e4f534a)throw Error("bad GLB");let js="";for(let i=20;i<20+n;i++)js+=String.fromCharCode(bytes[i]);const g=JSON.parse(js),oldBin=bytes.slice(28+n);if(d.getUint32(24+n,true)!==0x004e4942||d.getUint32(20+n,true)!==oldBin.length||g.buffers[0].byteLength!==oldBin.length)throw Error("bad buffer");
 if(g.meshes.length!==3||g.textures)throw Error("Unexpected baseline");
 const chunks=[oldBin];let offset=oldBin.length;
 function append(bytes,target){if(offset%4)throw Error("unaligned");const ix=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,...(target?{target}:{})});chunks.push(bytes);offset+=bytes.length;const pad=(4-offset%4)%4;if(pad){chunks.push(new Uint8Array(pad));offset+=pad;}return ix;}
 function acc(arr,dim,bounds){const f=new Float32Array(arr),v=append(new Uint8Array(f.buffer),34962);const a={bufferView:v,componentType:5126,count:arr.length/dim,type:"VEC"+dim};if(bounds){a.min=Array(dim).fill(Infinity);a.max=Array(dim).fill(-Infinity);for(let i=0;i<f.length;i++){const j=i%dim;a.min[j]=Math.min(a.min[j],f[i]);a.max[j]=Math.max(a.max[j],f[i]);}}g.accessors.push(a);return g.accessors.length-1;}
 function read(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView];if(a.type!=="VEC3"||a.componentType!==5126||v.byteOffset+a.count*12>oldBin.length)throw Error("bad original vertex accessor");const dv=new DataView(oldBin.buffer,oldBin.byteOffset+v.byteOffset,a.count*12);return Array.from({length:a.count*3},(_,i)=>dv.getFloat32(i*4,true));}
 // Minimal standard PNG (uncompressed zlib), deterministic and dependency-free.
 function png(size,pixel){
  const be=x=>[(x>>>24)&255,(x>>>16)&255,(x>>>8)&255,x&255];
  const crc=a=>{let c=0xffffffff;for(const x of a){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
  const chunk=(name,data)=>{const a=[...Array.from(name,c=>c.charCodeAt(0)),...data];return [...be(data.length),...a,...be(crc(a))];};
  const raw=[];for(let y=0;y<size;y++){raw.push(0);for(let x=0;x<size;x++)raw.push(...pixel(x,y));}let a=1,b=0;for(const x of raw){a=(a+x)%65521;b=(b+a)%65521;}const l=raw.length,z=[0x78,0x01,1,l&255,l>>>8,(~l)&255,((~l)>>>8)&255,...raw,...be((b<<16)|a)];
  return new Uint8Array([137,80,78,71,13,10,26,10,...chunk("IHDR",[...be(size),...be(size),8,2,0,0,0]),...chunk("IDAT",z),...chunk("IEND",[])]);
 }
 g.images=[];g.textures=[];g.samplers=[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}];
 const tex=(name,fn)=>{g.images.push({name,mimeType:"image/png",bufferView:append(png(32,fn))});g.textures.push({source:g.images.length-1,sampler:0});return {index:g.textures.length-1};};
 const tile=(x,y)=>((x*13+y*17+x*y*3)%19)/18;
 const profiles={terrain:[.035,27],stone:[.12,35],paving:[.1,24],foliage:[.15,30],wood:[.22,30],grass_edge:[.035,28]};
 const textureFor={};
 for(const [name,[frequency,amp]] of Object.entries(profiles)){
  const pattern=(x,y)=>Math.round(225+amp*(.45*Math.sin(2*Math.PI*(frequency===.22?4:2)*x/32)+.25*Math.cos(2*Math.PI*4*y/32)+.3*(tile(x,y)-.5)));
  textureFor[name]=tex(name+"_original_surface",(x,y)=>{const v=pattern(x,y);return [v,v,v];});
 }
 for(const mat of g.materials)if(textureFor[mat.name])mat.pbrMetallicRoughness.baseColorTexture=textureFor[mat.name];
 for(const mesh of g.meshes)for(const primitive of mesh.primitives){
  if(!g.materials[primitive.material].pbrMetallicRoughness.baseColorTexture)continue;
  const pos=read(primitive.attributes.POSITION),normal=read(primitive.attributes.NORMAL),uv=[];
  for(let i=0;i<pos.length;i+=9){const sums=[0,1,2].map(k=>Math.abs(normal[i+k]+normal[i+3+k]+normal[i+6+k]));const axis=sums.indexOf(Math.max(...sums));const axes=[0,1,2].filter(k=>k!==axis);for(let v=0;v<3;v++)uv.push(pos[i+3*v+axes[0]]*.35,pos[i+3*v+axes[1]]*.35);}
  primitive.attributes.TEXCOORD_0=acc(uv,2,false);
 }
 const detailMats=[["engraved_stone",[.32,.39,.42],.14,.77],["warm_gold",[.62,.43,.17],.68,.33],["cool_inlay",[.14,.43,.51],.30,.43],["lux_inlay",[.14,.42,.75],.36,.42],["tenebra_inlay",[.55,.08,.10],.36,.42],["river_bank",[.19,.28,.30],.05,.84]];
 const startMat=g.materials.length;for(const [name,c,m,r] of detailMats)g.materials.push({name,pbrMetallicRoughness:{baseColorFactor:[...c,1],metallicFactor:m,roughnessFactor:r}});
 const groups=new Map();let details=0;
 function tri(m,a,b,c){const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...cross);if(len<1e-7)return;let s=groups.get(m);if(!s){s={p:[],n:[]};groups.set(m,s);}for(const q of [a,b,c]){if(q[0]<0||q[0]>320||q[2]<0||q[2]>220||q[1]<0||q[1]>.4)throw Error("detail outside flat decoration envelope");s.p.push(...q);s.n.push(...cross.map(x=>x/len));}details++;}
 function quad(m,a,b,c,d){tri(m,a,b,c);tri(m,a,c,d);}
 function flat(m,x,z,w,h,y){quad(m,[x-w/2,y,z-h/2],[x-w/2,y,z+h/2],[x+w/2,y,z+h/2],[x+w/2,y,z-h/2]);}
 function diamond(m,x,z,w,h,y){quad(m,[x-w/2,y,z],[x,y,z+h/2],[x+w/2,y,z],[x,y,z-h/2]);}
 function ring(m,x,z,r,w,y,segments=24){for(let i=0;i<segments;i++){const a=2*Math.PI*i/segments,b=2*Math.PI*(i+1)/segments;const at=(t,r)=>[x+Math.cos(t)*r,y,z+Math.sin(t)*r];quad(m,at(a,r-w),at(b,r-w),at(b,r),at(a,r));}}
 const lanes=[41.8,110,178.2];
 for(const z of lanes){
  for(let x=25;x<300;x+=8){if(Math.abs(x-160)<11||Math.abs(z-110)<.1&&(x<30||x>290))continue;
   // Inset curb stones and small decorative paving; no added collider or gameplay obstacles.
   for(const side of [-1,1]){flat(0,x,z+side*4.6,5.8,.55,.102);flat(1,x,z+side*5.05,2.2,.14,.104);}
   if(x%16===9)diamond(2,x,z,1.7,2.6,.107);
  }
  for(let x=153;x<=167;x+=2.8){flat(0,x,z,2.45,8.5,.255);for(const side of [-1,1])flat(1,x,z+side*4.35,2.45,.15,.257);}
 }
 for(let z=8;z<214;z+=5){if(lanes.some(y=>Math.abs(z-y)<7))continue;for(const side of [-1,1]){flat(5,160+side*6.25,z,.65,3.8,.12);flat(0,160+side*7,z,.3,2.9,.105);}}
 for(const [x,m] of [[14,3],[306,4]]){
  for(const r of [4.1,7.7,10.8])ring(m,x,110,r,.18,.15,32);
  for(let i=0;i<8;i++){const t=i*Math.PI/4;diamond(1,x+Math.cos(t)*8.8,110+Math.sin(t)*8.8,1.05,1.05,.15);}
 }
 const cover=[[.29,.23,.025],[.71,.77,.025],[.42,.41,.025],[.58,.59,.025],[.48,.81,.018],[.52,.19,.018]];
 for(const [nx,nz,nr] of cover){ring(2,nx*320,nz*220,nr*220+.52,.16,.13,20);}
 const primitives=[];for(const [m,v] of groups){primitives.push({mode:4,material:startMat+m,attributes:{POSITION:acc(v.p,3,true),NORMAL:acc(v.n,3,false)}});}
 g.meshes.push({name:"GenesisRift_detail_inlays",primitives});g.nodes.push({name:"GenesisRift_detail_inlays",mesh:g.meshes.length-1});g.scenes[0].nodes.push(g.nodes.length-1);
 g.extras={...g.extras,revision:"original arena detail v2",reviewOnly:true,collisionChange:false,detailTriangles:details};g.buffers[0].byteLength=offset;
 const str=JSON.stringify(g),j=str.length+(4-str.length%4)%4,out=new Uint8Array(28+j+offset),dv=new DataView(out.buffer);
 dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,out.length,true);dv.setUint32(12,j,true);dv.setUint32(16,0x4e4f534a,true);for(let i=0;i<j;i++)out[20+i]=i<str.length?str.charCodeAt(i):32;dv.setUint32(20+j,offset,true);dv.setUint32(24+j,0x004e4942,true);let cur=28+j;for(const chunk of chunks){out.set(chunk,cur);cur+=chunk.length;}
 if(cur!==out.length||details>2500)throw Error("Geometry budget failure");
 return {bytes:out,detailTriangles:details,textures:g.textures.length,originalBinaryBytes:oldBin.length};
}
const source=new URL('./AssetCandidates/genesis_rift_candidate.glb',import.meta.url);const output=new URL('./AssetCandidates/genesis_rift_detail_review.glb',import.meta.url);const result=enrichArena(readFileSync(source));writeFileSync(output,result.bytes);console.log(result.detailTriangles,result.textures,result.bytes.length);
