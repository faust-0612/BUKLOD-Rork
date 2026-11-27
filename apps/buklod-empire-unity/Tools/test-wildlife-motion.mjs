import {generateWildlife} from './wildlife-review.mjs';
export function validateWildlife(rows){
 const durations=new Set(),ids=new Set();let channels=0,clips=0,triangles=0,hover=0;
 for(const r of rows){
  if(ids.has(r.id))throw Error("Duplicate wildlife");ids.add(r.id);
  const d=new DataView(r.bytes.buffer,r.bytes.byteOffset,r.bytes.byteLength),n=d.getUint32(12,true);
  if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==r.bytes.length||n%4||d.getUint32(16,true)!==0x4e4f534a||d.getUint32(24+n,true)!==0x004e4942||d.getUint32(20+n,true)!==r.bytes.length-28-n)throw Error("Bad wildlife GLB "+r.id);
  const doc=JSON.parse(String.fromCharCode(...r.bytes.subarray(20,20+n)));
  if(doc.extras.motionRevision!=="species-motion-v3")throw Error("Stale wildlife motion");
  function read(i,width){const a=doc.accessors[i],v=doc.bufferViews[a.bufferView];if(a.componentType!==5126||!Number.isInteger(a.count)||a.count<1||a.count*width*4>v.byteLength||v.byteOffset+v.byteLength>doc.buffers[0].byteLength)throw Error("Invalid accessor");
   return Array.from({length:a.count},(_,k)=>Array.from({length:width},(_,j)=>d.getFloat32(28+n+v.byteOffset+(a.byteOffset||0)+(k*width+j)*4,true)));
  }
  let tris=0;for(const p of doc.meshes[0].primitives){const pos=read(p.attributes.POSITION,3);if(pos.length%3||pos.some(v=>v.some(x=>!Number.isFinite(x))))throw Error("Invalid wildlife mesh");tris+=pos.length/3;}
  if(tris!==r.triangles)throw Error("Triangle mismatch");triangles+=tris;
  if(r.kind!=="creature"){if(doc.animations||doc.skins)throw Error("Resource rig");continue;}
  if(doc.skins[0].joints.length!==8||doc.animations.length!==6)throw Error("Incomplete wildlife rig");
  for(const clip of doc.animations){
   const targets=new Set(),rotations=new Set();let end=0;
   for(const ch of clip.channels){const s=clip.samplers[ch.sampler],width=ch.target.path==="rotation"?4:3,key=ch.target.node+":"+ch.target.path;
    if(targets.has(key)||!doc.skins[0].joints.includes(ch.target.node))throw Error("Duplicate/invalid target");targets.add(key);
    const time=read(s.input,1).flat(),val=read(s.output,width);
    if(time.length!==13||val.length!==13||time[0]!==0||time.some((x,i)=>!Number.isFinite(x)||i>0&&x<=time[i-1]))throw Error("Invalid times");
    end=time.at(-1);if(val.some(v=>v.some(x=>!Number.isFinite(x))))throw Error("Nonfinite pose");
    if(width===4){rotations.add(ch.target.node);if(val.some(v=>Math.abs(Math.hypot(...v)-1)>1e-4))throw Error("Nonunit quaternion");}
    else {if(clip.name!=="Idle"||ch.target.node!==0||Math.abs(val[0][1])+Math.abs(val.at(-1)[1])>1e-5||Math.max(...val.map(v=>v[1]))<=0)throw Error("Invalid hover");hover++;}
    channels++;
   }
   if(rotations.size!==8)throw Error("Missing rotations");
   if(clip.name==="Idle")durations.add(end);clips++;
  }
 }
 if(ids.size!==14||clips!==54||durations.size!==9||hover!==2)throw Error("Incomplete wildlife motion coverage");
 return {models:ids.size,clips,channels,triangles,distinctIdleDurations:durations.size,hover};
}
console.log("BUKLOD_WILDLIFE_MOTION_PASS",JSON.stringify(validateWildlife(generateWildlife())));
