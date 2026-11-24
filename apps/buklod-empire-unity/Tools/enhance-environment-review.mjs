// Original deterministic environment revision. Node 18+, no packages or network.
import {readFileSync,writeFileSync} from 'node:fs';
function enhance(bytes){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=d.getUint32(12,true);
 if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==bytes.length||d.getUint32(16,true)!==0x4e4f534a)throw Error("Invalid GLB");
 let s="";for(let i=20;i<20+n;i++)s+=String.fromCharCode(bytes[i]);const g=JSON.parse(s),old=bytes.slice(28+n);
 if(d.getUint32(24+n,true)!==0x004e4942||d.getUint32(20+n,true)!==old.length||g.buffers[0].byteLength!==old.length||g.meshes.length!==4||g.images.length!==6)throw Error("Unexpected v2 source");
 const chunks=[old];let offset=old.length;
 function append(a,target){const i=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:a.length,...(target?{target}:{})});chunks.push(a);offset+=a.length;const pad=(4-offset%4)%4;if(pad){chunks.push(new Uint8Array(pad));offset+=pad;}return i;}
 const clamp=x=>Math.max(0,Math.min(255,Math.round(x)));
 // PNG with standard uncompressed zlib block. 64x64 RGB.
 function png(pixel){const N=64,be=x=>[(x>>>24)&255,(x>>>16)&255,(x>>>8)&255,x&255];function crc(a){let c=0xffffffff;for(const x of a){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0}function chunk(name,data){const a=[...Array.from(name,c=>c.charCodeAt(0)),...data];return [...be(data.length),...a,...be(crc(a))]}const raw=[];for(let y=0;y<N;y++){raw.push(0);for(let x=0;x<N;x++)raw.push(...pixel(x,y).map(clamp));}let a=1,b=0;for(const x of raw){a=(a+x)%65521;b=(b+a)%65521;}const l=raw.length,z=[0x78,1,1,l&255,l>>>8,(~l)&255,((~l)>>>8)&255,...raw,...be((b<<16)|a)];return new Uint8Array([137,80,78,71,13,10,26,10,...chunk("IHDR",[...be(N),...be(N),8,2,0,0,0]),...chunk("IDAT",z),...chunk("IEND",[])])}
 function tex(name,fn){g.images.push({name,mimeType:"image/png",bufferView:append(png(fn))});g.textures.push({source:g.images.length-1,sampler:0});return {index:g.textures.length-1};}
 const tau=2*Math.PI,mod=(x,m)=>((x%m)+m)%m;
 const noise=(x,y)=>{x=mod(x,64);y=mod(y,64);let k=Math.imul(x+19,374761393)^Math.imul(y+47,668265263);k=Math.imul(k^(k>>>13),1274126177);return ((k^(k>>>16))>>>0)/4294967295};
 function height(kind,x,y){
   x=mod(x,64);y=mod(y,64);const n=noise(x,y),coarse=.5+.23*Math.sin(tau*x/32+Math.cos(tau*y/32))+.18*Math.cos(tau*y/16+.4*Math.sin(tau*x/16));
   if(kind==="paving"||kind==="stone"){const w=kind==="paving"?16:32,h=16;const yy=mod(y,h),xx=mod(x+(Math.floor(y/h)%2)*w/2,w);const edge=Math.min(xx,w-xx,yy,h-yy);return .22+.45*Math.min(1,edge/2)+.20*coarse+.09*n;}
   if(kind==="wood")return .5+.22*Math.sin(tau*x/8+.4*Math.sin(tau*y/32))+.11*n;
   if(kind==="foliage")return .42+.30*Math.abs(Math.sin(tau*x/16)*Math.cos(tau*y/8))+.20*n;
   return .24+.48*coarse+.20*n;
 }
 const kinds=["terrain","stone","paving","foliage","wood","grass_edge"];
 const stats=[];
 for(const kind of kinds){
   const m=g.materials.find(v=>v.name===kind);if(!m)throw Error("Missing "+kind);const p=m.pbrMetallicRoughness;
   p.baseColorTexture=tex(kind+"_v3_albedo",(x,y)=>{const h=height(kind,x,y),v=145+105*h;return kind==="terrain"||kind==="grass_edge"?[v*.92,v,v*.85]:kind==="wood"?[v,v*.94,v*.82]:kind==="foliage"?[v*.88,v,v*.91]:[v*.95,v*.98,v];});
   p.metallicRoughnessTexture=tex(kind+"_v3_roughness",(x,y)=>[255,Math.min(255,190+60*(1-height(kind,x,y))),255]);
   // Only surfaces with existing UVs are given these textures; old material factors retained.
   stats.push(kind);
 }
 // Low-poly vegetation clusters in the existing outer decorative belt only.
 const groups=[{p:[],n:[]},{p:[],n:[]}];let plants=0;
 function tri(k,a,b,c){const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l<1e-8)throw Error("Degenerate detail");for(const q of [a,b,c]){if(q[0]<0||q[0]>320||q[2]<0||q[2]>220||q[1]<0||q[1]>2.5)throw Error("Outside visual envelope");groups[k].p.push(...q);groups[k].n.push(...n.map(x=>x/l));}}
 for(let side=0;side<2;side++)for(let i=0;i<36;i++){
   const x=8+i*8.6,z=side===0?4.5+2*noise(i,3):215.5-2*noise(i,3);
   if(Math.abs(x-160)<10)continue;
   const r=.45+.45*noise(i,side+7),h=.45+1.1*noise(i,side+19);
   // Six radial spear-shaped foliage leaves; opaque, double-sided, no overdraw-heavy particles.
   for(let j=0;j<6;j++){const t=j*tau/6+noise(i,side)*.7,dx=Math.cos(t),dz=Math.sin(t),w=r*.24,tip=[x+dx*r,h,z+dz*r],base=[x,.02,z],left=[x+dx*r*.45-dz*w,h*.38,z+dz*r*.45+dx*w],right=[x+dx*r*.45+dz*w,h*.38,z+dz*r*.45-dx*w];tri((i+j)%2,base,left,tip);tri((i+j)%2,base,tip,right);}
   plants++;
 }
 function acc(a){const f=new Float32Array(a),view=append(new Uint8Array(f.buffer),34962),row={bufferView:view,componentType:5126,count:a.length/3,type:"VEC3",min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(let i=0;i<f.length;i++){row.min[i%3]=Math.min(row.min[i%3],f[i]);row.max[i%3]=Math.max(row.max[i%3],f[i]);}g.accessors.push(row);return g.accessors.length-1;}
 const prim=[];for(let k=0;k<2;k++){const material=g.materials.length;g.materials.push({name:"border_leaf_"+k,doubleSided:true,pbrMetallicRoughness:{baseColorFactor:k?[.15,.33,.13,1]:[.27,.44,.16,1],metallicFactor:0,roughnessFactor:.92}});prim.push({material,mode:4,attributes:{POSITION:acc(groups[k].p),NORMAL:acc(groups[k].n)}})}
 g.meshes.push({name:"GenesisRift_border_foliage",primitives:prim});g.nodes.push({name:"GenesisRift_border_foliage",mesh:g.meshes.length-1});g.scenes[0].nodes.push(g.nodes.length-1);
 const triangles=groups.reduce((a,x)=>a+x.p.length/9,0);if(triangles>900)throw Error("Foliage budget exceeded");
 g.extras={...g.extras,revision:"original arena environment v3",reviewOnly:true,collisionChange:false};g.buffers[0].byteLength=offset;
 const json=JSON.stringify(g),j=json.length+(4-json.length%4)%4,out=new Uint8Array(28+j+offset),dv=new DataView(out.buffer);dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,out.length,true);dv.setUint32(12,j,true);dv.setUint32(16,0x4e4f534a,true);for(let i=0;i<j;i++)out[20+i]=i<json.length?json.charCodeAt(i):32;dv.setUint32(20+j,offset,true);dv.setUint32(24+j,0x004e4942,true);let cur=28+j;for(const a of chunks){out.set(a,cur);cur+=a.length;}if(cur!==out.length)throw Error("Output length");
 return {bytes:out,triangles,plants,maps:stats.length*2,originalBytes:old.length};
}
const r=enhance(readFileSync(new URL('./AssetCandidates/genesis_rift_detail_review.glb',import.meta.url)));writeFileSync(new URL('./AssetCandidates/genesis_rift_environment_review.glb',import.meta.url),r.bytes);console.log(r.triangles,r.plants,r.maps,r.bytes.length);
