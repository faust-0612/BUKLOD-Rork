// Deterministic glTFast-compatible faction vertex layout, preserving source rig,
// positions, material slots, animation samplers and triangle order.
export const FACTION_IMPORT_REVISION='indexed-uniform-skin-v1';
export function normalizeFactionGlb(input){
 const d=new DataView(input.buffer,input.byteOffset,input.byteLength),n=d.getUint32(12,true);
 if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==input.length||d.getUint32(16,true)!==0x4e4f534a||n%4||n+28>input.length||d.getUint32(24+n,true)!==0x004e4942||d.getUint32(20+n,true)!==input.length-28-n)throw Error('Invalid faction GLB');
 const g=JSON.parse(String.fromCharCode(...input.subarray(20,20+n))),old=input.subarray(28+n);
 if(g.meshes.length!==1||g.skins.length!==1||g.buffers[0].byteLength!==old.length||g.animations.length!==6)throw Error('Faction GLB scope mismatch');
 const chunks=[old];let offset=old.length;
 const widths={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
 function read(index,kind,component){
  const a=g.accessors[index],v=g.bufferViews[a?.bufferView],bytes=component===5123?2:4,width=widths[kind],stride=width*bytes;
  if(!a||!v||a.type!==kind||a.componentType!==component||a.sparse||a.normalized||v.buffer!==0||!Number.isSafeInteger(a.count)||a.count<1||(v.byteStride??stride)!==stride||(a.byteOffset??0)+a.count*stride>v.byteLength||(v.byteOffset??0)+v.byteLength>old.length)throw Error('Invalid faction accessor '+index);
  const b=new DataView(old.buffer,old.byteOffset+(v.byteOffset??0)+(a.byteOffset??0),a.count*stride);
  return Array.from({length:a.count*width},(_,i)=>component===5123?b.getUint16(i*2,true):b.getFloat32(i*4,true));
 }
 function add(values,kind,component=5126,bounds=false,index=false){
  const width=widths[kind],bytes=component===5123?2:4;
  if(!values.length||values.length%width||values.some(x=>!Number.isFinite(x)))throw Error('Invalid normalized accessor');
  const pad=(4-offset%4)%4;if(pad){chunks.push(new Uint8Array(pad));offset+=pad;}
  const raw=new Uint8Array(values.length*bytes),v=new DataView(raw.buffer);
  for(let i=0;i<values.length;i++){if(component===5123){if(!Number.isInteger(values[i])||values[i]<0||values[i]>65535)throw Error('Invalid uint16');v.setUint16(i*2,values[i],true);}else v.setFloat32(i*4,values[i],true);}
  const a={bufferView:g.bufferViews.length,componentType:component,type:kind,count:values.length/width};
  g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:raw.length,target:index?34963:34962});offset+=raw.length;chunks.push(raw);
  if(bounds){a.min=Array(width).fill(Infinity);a.max=Array(width).fill(-Infinity);for(let i=0;i<values.length;i++){const x=component===5123?v.getUint16(i*2,true):v.getFloat32(i*4,true),k=i%width;a.min[k]=Math.min(a.min[k],x);a.max[k]=Math.max(a.max[k],x);}}
  g.accessors.push(a);return g.accessors.length-1;
 }
 let vertices=0,triangles=0;
 for(const p of g.meshes[0].primitives){
  if((p.mode??4)!==4||p.indices!==undefined)throw Error('Expected original non-indexed faction triangles');
  const a=p.attributes,P=read(a.POSITION,'VEC3',5126),N=read(a.NORMAL,'VEC3',5126),J=read(a.JOINTS_0,'VEC4',5123),W=read(a.WEIGHTS_0,'VEC4',5126);
  const count=P.length/3;if(!count||count%3||count>65535||N.length!==P.length||J.length!==count*4||W.length!==J.length)throw Error('Faction vertex count mismatch');
  const uv=a.TEXCOORD_0===undefined?[]:read(a.TEXCOORD_0,'VEC2',5126),project=uv.length===0,tangent=[],jointCount=g.skins[0].joints.length;
  if(!project&&uv.length!==count*2)throw Error('Faction UV count mismatch');
  for(let i=0;i<count;i++){
   const o=i*3,k=i*4,normal=N.slice(o,o+3),l=Math.hypot(...normal);
   if(!Number.isFinite(l)||l<1e-8)throw Error('Invalid faction normal');
   const unit=normal.map(x=>x/l);N.splice(o,3,...unit);
   const abs=unit.map(Math.abs),axis=abs.indexOf(Math.max(...abs)),axes=[0,1,2].filter(x=>x!==axis);
   if(project)uv.push(P[o+axes[0]]*3,P[o+axes[1]]*3);
   const u=axes[0],v=axes[1],t=unit.map((x,j)=>(j===u?1:0)-unit[u]*x),tl=Math.hypot(...t),q=t.map(x=>x/tl);
   if(!Number.isFinite(tl)||tl<1e-8)throw Error('Invalid faction tangent');
   const cross=[unit[1]*q[2]-unit[2]*q[1],unit[2]*q[0]-unit[0]*q[2],unit[0]*q[1]-unit[1]*q[0]];
   tangent.push(...q,cross[v]>=0?1:-1);
   const pairs=J.slice(k,k+4).map((j,x)=>[j,W[k+x]]).sort((a,b)=>b[1]-a[1]);
   const sum=pairs.reduce((n,x)=>n+x[1],0);
   if(pairs.some(([j,w])=>!Number.isInteger(j)||j<0||j>=jointCount||!Number.isFinite(w)||w<0||w>1)||Math.abs(sum-1)>1e-5)throw Error('Invalid faction skin weights');
   for(let x=0;x<4;x++){J[k+x]=pairs[x][0];W[k+x]=pairs[x][1]/sum;}
  }
  p.attributes={POSITION:add(P,'VEC3',5126,true),NORMAL:add(N,'VEC3'),JOINTS_0:add(J,'VEC4',5123),WEIGHTS_0:add(W,'VEC4'),TEXCOORD_0:add(uv,'VEC2'),TANGENT:add(tangent,'VEC4')};
  p.indices=add(Array.from({length:count},(_,i)=>i),'SCALAR',5123,true,true);vertices+=count;triangles+=count/3;
 }
 const pad=(4-offset%4)%4;if(pad){chunks.push(new Uint8Array(pad));offset+=pad;}
 g.buffers[0].byteLength=offset;g.extras={...g.extras,importRevision:FACTION_IMPORT_REVISION};
 const json=JSON.stringify(g),size=json.length+(4-json.length%4)%4,out=new Uint8Array(28+size+offset),header=new DataView(out.buffer);
 [0x46546c67,2,out.length,size,0x4e4f534a].forEach((x,i)=>header.setUint32(i*4,x,true));
 for(let i=0;i<size;i++)out[20+i]=i<json.length?json.charCodeAt(i):32;
 header.setUint32(20+size,offset,true);header.setUint32(24+size,0x004e4942,true);
 let cursor=28+size;for(const chunk of chunks){out.set(chunk,cursor);cursor+=chunk.length;}
 return {bytes:out,vertices,triangles};
}
