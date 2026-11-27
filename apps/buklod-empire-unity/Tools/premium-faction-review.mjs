// Original faction unit detail. Node 18+, no network or packages.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeFactionGlb,FACTION_IMPORT_REVISION} from './normalize-faction-glb.mjs';
function unpackStoredZip(bytes){
 const d=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=new Map();let p=0;
 while(p+30<=bytes.length&&d.getUint32(p,true)===0x04034b50){
  const flags=d.getUint16(p+6,true),method=d.getUint16(p+8,true),crc=d.getUint32(p+14,true),size=d.getUint32(p+18,true),len=d.getUint16(p+26,true),extra=d.getUint16(p+28,true);
  if(flags!==0||method!==0||size!==d.getUint32(p+22,true))throw Error("Unexpected ZIP format");
  const name=String.fromCharCode(...bytes.slice(p+30,p+30+len)),start=p+30+len+extra,end=start+size;
  if(!/^(lux|tenebra)_[a-z]+\.glb$/.test(name)||out.has(name)||end>bytes.length)throw Error("Invalid ZIP entry");
  const data=bytes.slice(start,end);let c=0xffffffff;for(const x of data){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
  if(((c^0xffffffff)>>>0)!==crc)throw Error("CRC mismatch");out.set(name,data);p=end;
 }
 if(out.size!==11||d.getUint32(p,true)!==0x02014b50)throw Error("Incomplete faction ZIP");return out;
}
function enhanceUnit(input,id){
 const d=new DataView(input.buffer,input.byteOffset,input.byteLength),n=d.getUint32(12,true);
 if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==input.length||d.getUint32(16,true)!==0x4e4f534a)throw Error("GLB header");
 const g=JSON.parse(String.fromCharCode(...input.slice(20,20+n))),old=input.slice(28+n);
 if(d.getUint32(24+n,true)!==0x004e4942||d.getUint32(20+n,true)!==old.length||g.buffers[0].byteLength!==old.length||g.meshes.length!==1||g.meshes[0].name!==id||g.animations.length!==6||g.skins.length!==1)throw Error("Source mismatch "+id);
 const team=id.split("_")[0],role=id.split("_")[1],lux=team==="lux",siege=role==="siege",villager=!["infantry","mage","gunner","siege","healer"].includes(role);
 const roster=lux?["aron","lira","daren","serah","kiel","miko"]:["rogar","velin","kael","mora","zed","taro"];
 if(villager&&!roster.includes(role))throw Error("Unknown role");
 const joints=g.skins[0].joints.map(i=>g.nodes[i].name),bone=name=>{const i=joints.indexOf(name);if(i<0)throw Error("Missing bone "+name);return i;};
 const chunks=[old];let offset=old.length;
 function acc(arr,kind,component=5126,position=false){
  const width={VEC2:2,VEC3:3,VEC4:4}[kind],stride=component===5123?2:4,b=new Uint8Array(arr.length*stride),v=new DataView(b.buffer);
  if(arr.length%width||arr.some(x=>!Number.isFinite(x)))throw Error("Invalid attribute");
  for(let i=0;i<arr.length;i++)component===5123?v.setUint16(i*2,arr[i],true):v.setFloat32(i*4,arr[i],true);
  if(offset%4){const pad=new Uint8Array(4-offset%4);chunks.push(pad);offset+=pad.length;}
  const view=g.bufferViews.length;g.bufferViews.push({buffer:0,byteOffset:offset,byteLength:b.length,target:34962});chunks.push(b);offset+=b.length;
  const a={bufferView:view,componentType:component,count:arr.length/width,type:kind};
  if(position){a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<arr.length;i++){const k=i%3,x=v.getFloat32(i*4,true);a.min[k]=Math.min(a.min[k],x);a.max[k]=Math.max(a.max[k],x);}}
  g.accessors.push(a);return g.accessors.length-1;
 }
 const mats={};for(const [name,c,m,r,e] of [
 ["plate",lux?[.62,.72,.83]:[.16,.17,.23],.72,.32],["edge",lux?[.76,.49,.12]:[.57,.09,.11],.68,.30],
 ["cloth",lux?[.09,.26,.56]:[.25,.055,.09],.02,.87],["leather",[.24,.15,.09],.02,.84],
 ["gem",lux?[.12,.65,.95]:[.90,.10,.14],.28,.25,lux?[.025,.19,.32]:[.33,.02,.035]],
 ["skin",[.59,.37,.23],0,.78],["dark",[.035,.045,.055],.12,.81]
 ]){mats[name]=g.materials.length;g.materials.push({name:"review_"+team+"_"+name,pbrMetallicRoughness:{baseColorFactor:[...c,1],metallicFactor:m,roughnessFactor:r},...(e?{emissiveFactor:e}:{})});}
 const groups=new Map();let count=0;
 function tri(mat,j,a,b,c){
  const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);
  if(l<1e-8)return;const norm=n.map(x=>x/l);if(!groups.has(mat))groups.set(mat,{p:[],n:[],j:[],w:[],uv:[]});const q=groups.get(mat);
  const axis=norm.map(Math.abs).indexOf(Math.max(...norm.map(Math.abs))),axes=[0,1,2].filter(k=>k!==axis);
  for(const p of [a,b,c]){
   if(p.some(x=>!Number.isFinite(x))||Math.abs(p[0])>1.4||p[1]<0||p[1]>3.15||Math.abs(p[2])>1.6)throw Error("Visual envelope "+id);
   q.p.push(...p);q.n.push(...norm);q.j.push(j,0,0,0);q.w.push(1,0,0,0);q.uv.push(p[axes[0]]*3,p[axes[1]]*3);
  }count++;
 }
 function loft(mat,j,c,rings,N=12){
  const rows=rings.map(([y,rx,rz])=>Array.from({length:N},(_,i)=>{const a=2*Math.PI*i/N;return [c[0]+rx*Math.cos(a),c[1]+y,c[2]+rz*Math.sin(a)];}));
  for(let r=0;r<rows.length-1;r++)for(let i=0;i<N;i++){const k=(i+1)%N;tri(mat,j,rows[r][i],rows[r+1][i],rows[r+1][k]);tri(mat,j,rows[r][i],rows[r+1][k],rows[r][k]);}
  for(let i=0;i<N;i++){const k=(i+1)%N;tri(mat,j,[c[0],c[1]+rings[0][0],c[2]],rows[0][i],rows[0][k]);const t=rows.length-1;tri(mat,j,[c[0],c[1]+rings[t][0],c[2]],rows[t][k],rows[t][i]);}
 }
 function jewel(mat,j,c,rx,ry,rz,N=10){loft(mat,j,c,[[-ry,rx*.12,rz*.12],[-ry*.55,rx*.8,rz*.8],[0,rx,rz],[ry*.6,rx*.72,rz*.72],[ry,rx*.10,rz*.10]],N);}
 function plate(mat,j,x,y,z,w,h,depth=.035){
  const outline=lux?[[-w/2,0],[-w*.32,-h/2],[w*.32,-h/2],[w/2,0],[0,h/2]]:[[-w/2,h*.30],[-w*.43,-h*.25],[0,-h/2],[w*.43,-h*.25],[w/2,h*.30],[0,h*.55]];
  const f=outline.map(([a,b])=>[x+a,y+b,z+depth]),b=outline.map(([a,b])=>[x+a,y+b,z-depth]);
  for(let i=0;i<f.length;i++){const k=(i+1)%f.length;tri(mat,j,[x,y,z+depth*1.5],f[i],f[k]);tri(mat,j,f[i],b[i],b[k]);tri(mat,j,f[i],b[k],f[k]);tri(mat,j,[x,y,z-depth],b[k],b[i]);}
 }
 if(siege){
  const chassis=bone("Chassis"),turret=bone("Turret");
  for(const side of [-1,1]){
   const j=bone(side<0?"TrackL":"TrackR");for(let i=0;i<6;i++){const z=-.64+i*.25;jewel("edge",j,[side*.99,.39,z],.07,.10,.10,8);}
   for(let i=0;i<4;i++)plate("plate",chassis,side*.65,.74,-.44+i*.28,.30,.25,.045);
  }
  for(const z of [.48,.76,1.04])loft("edge",turret,[0,1.27,z],[[-.18,.30,.075],[.18,.30,.075]],12);
  jewel("gem",turret,[0,1.76,-.12],.24,.19,.23,12);
 }else{
  const chest=bone("Chest"),head=bone("Head"),right=bone("ArmR"),left=bone("ArmL");
  const w=villager?.3+(roster.indexOf(role)%3)*.04:role==="infantry"?.50:.36;
  for(const [side,j] of [[-1,left],[1,right]]){
   const x=side*(w+(villager?.07:.10)),y=villager?1.29:1.41;
   jewel(villager?"cloth":"plate",j,[x,y,.075],villager?.12:.22,.14,.17,12);
   for(let k=0;k<3;k++)jewel("edge",j,[x+side*.022,y-.15-k*.072,.135],.035,.028,.028,8);
   const leg=bone(side<0?"LegL":"LegR"),lx=side*(villager?.15:w*.55);
   for(let k=0;k<2;k++)plate(villager?"leather":"edge",leg,lx,.32+k*.14,.17,villager?.14:.23,.10,.027);
  }
  if(villager){
   // Facial details and job-specific tool accessories retain the original mesh/rig.
   for(const side of [-1,1]){jewel("dark",head,[side*.073,1.68,.227],.029,.012,.014,8);jewel("skin",head,[side*.233,1.65,0],.033,.065,.045,10);}
   jewel("skin",head,[0,1.64,.235],.034,.057,.045,12);
   jewel("leather",head,[0,1.58,.218],.048,.011,.018,8);
   for(let k=0;k<5;k++)jewel("edge",chest,[(k-2)*.062,.91,.29],.023,.024,.017,8);
   const ix=roster.indexOf(role);
   if(ix===0){for(let k=0;k<3;k++)plate("edge",right,.46,1.72,.308-k*.11,.23,.11,.025);}
   if(ix===1){for(let k=0;k<5;k++)loft("leather",left,[-.46,1.08+k*.065,.22],[[-.016,.15,.155],[.016,.15,.155]],12);}
   if(ix===2){for(let k=0;k<4;k++)loft("edge",right,[.43,1.02+k*.07,.17],[[-.022,.085,.085],[.022,.085,.085]],10);}
   if(ix===3){for(let k=0;k<3;k++)jewel("gem",right,[.47,1.93+k*.12,.18],.11,.07,.11,10);}
   if(ix===4){for(let k=0;k<4;k++)plate("edge",right,.43,1.04+k*.085,.40,.19,.045,.012);}
   if(ix===5){for(let k=0;k<3;k++)plate("leather",chest,0,1.01+k*.15,-.46,.41,.095,.025);}
  }else{
   for(let k=0;k<3;k++)plate("edge",chest,0,1.10+k*.125,.32,w*1.20,.095,.028);
   for(const side of [-1,1])plate("edge",head,side*.23,1.91,.16,.13,.20,.035);
   jewel("gem",head,[0,1.98,.25],.064,.09,.045,12);
   if(role==="infantry"){for(let k=0;k<4;k++)jewel("edge",left,[-.62, .91+k*.16,.355],.09,.04,.025,8);plate("gem",left,-.62,1.25,.36,.23,.36,.035);}
   if(role==="mage"||role==="healer"){for(let k=0;k<3;k++)loft("edge",right,[.63,2.23+k*.16,.16],[[-.035,.115,.115],[.035,.115,.115]],12);for(let k=0;k<4;k++){const a=k*Math.PI/2;jewel("gem",right,[.63+.17*Math.cos(a),2.61,.16+.17*Math.sin(a)],.065,.13,.065,8);}}
   if(role==="gunner"){for(let k=0;k<4;k++)plate("edge",right,.45,1.39,.18+k*.19,.27,.08,.025);}
  }
 }
 if(count<200||count>5000)throw Error("Detail budget "+id);
 for(const [name,q] of groups)g.meshes[0].primitives.push({mode:4,material:mats[name],attributes:{POSITION:acc(q.p,"VEC3",5126,true),NORMAL:acc(q.n,"VEC3"),JOINTS_0:acc(q.j,"VEC4",5123),WEIGHTS_0:acc(q.w,"VEC4"),TEXCOORD_0:acc(q.uv,"VEC2")}});
 if(offset%4){const pad=new Uint8Array(4-offset%4);chunks.push(pad);offset+=pad.length;}
 g.buffers[0].byteLength=offset;g.extras={...g.extras,revision:"faction-detail-v2",reviewOnly:true,addedTriangles:count};
 const s=JSON.stringify(g),j=s.length+(4-s.length%4)%4,out=new Uint8Array(28+j+offset),dv=new DataView(out.buffer);
 [0x46546c67,2,out.length,j,0x4e4f534a].forEach((x,i)=>dv.setUint32(i*4,x,true));for(let i=0;i<j;i++)out[20+i]=i<s.length?s.charCodeAt(i):32;dv.setUint32(20+j,offset,true);dv.setUint32(24+j,0x004e4942,true);let cursor=28+j;for(const p of chunks){out.set(p,cursor);cursor+=p.length;}
 if(cursor!==out.length)throw Error("Length mismatch");return {bytes:out,addedTriangles:count};
}
function validate(source,output){
 function parse(b){const d=new DataView(b.buffer,b.byteOffset,b.byteLength),n=d.getUint32(12,true);return {g:JSON.parse(String.fromCharCode(...b.slice(20,20+n))),bin:b.slice(28+n)}}
 const a=parse(source),b=parse(output);if(!a.bin.every((v,i)=>v===b.bin[i]))throw Error("Source binary changed");
 for(const k of ["nodes","skins","animations"])if(JSON.stringify(a.g[k])!==JSON.stringify(b.g[k]))throw Error("Rig/animation changed");
 for(const k of ["accessors","bufferViews","materials"])if(JSON.stringify(a.g[k])!==JSON.stringify(b.g[k].slice(0,a.g[k].length)))throw Error("Source records changed");
 const orig=a.g.meshes[0].primitives,now=b.g.meshes[0].primitives;if(JSON.stringify(orig)!==JSON.stringify(now.slice(0,orig.length)))throw Error("Original geometry changed");
 function read(i){const a=b.g.accessors[i],v=b.g.bufferViews[a.bufferView],width={VEC2:2,VEC3:3,VEC4:4}[a.type],stride=a.componentType===5123?2:4;if(!width||v.byteOffset%4||a.count*width*stride!==v.byteLength||v.byteOffset+v.byteLength>b.bin.length)throw Error("Accessor bounds");const d=new DataView(b.bin.buffer,b.bin.byteOffset+v.byteOffset,v.byteLength);return Array.from({length:a.count*width},(_,i)=>stride===2?d.getUint16(i*2,true):d.getFloat32(i*4,true));}
 for(const p of now.slice(orig.length)){const q=p.attributes,P=read(q.POSITION),N=read(q.NORMAL),J=read(q.JOINTS_0),W=read(q.WEIGHTS_0),UV=read(q.TEXCOORD_0);if(P.length!==N.length||P.length%9||P.length/3!==J.length/4||J.length!==W.length||P.length/3!==UV.length/2)throw Error("Attribute counts");
 if([...P,...N,...W,...UV].some(x=>!Number.isFinite(x))||J.some(x=>x<0||x>=b.g.skins[0].joints.length))throw Error("Data integrity");
 for(let i=0;i<N.length;i+=3)if(Math.abs(Math.hypot(...N.slice(i,i+3))-1)>1e-5)throw Error("Normal");
 for(let i=0;i<W.length;i+=4)if(Math.abs(W.slice(i,i+4).reduce((a,b)=>a+b,0)-1)>1e-6||W.slice(i,i+4).some(x=>x<0||x>1))throw Error("Weights");
 }
}
const root=new URL('./AssetCandidates/Rigged/',import.meta.url),out=new URL('./ReviewOutput/premium-factions/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));const rows=[];const generated=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const pkg of manifest.packages){const source=readFileSync(new URL(pkg.team+'_rigged_review.zip',root));const blob=createHash('sha1').update('blob '+source.length+'\0').update(source).digest('hex');if(blob!==pkg.gitBlob)throw Error('Source archive hash');const entries=unpackStoredZip(source);if(entries.size!==pkg.models.length||pkg.models.some(m=>!entries.has(m.id+'.glb')))throw Error('Roster mismatch');for(const [name,data] of entries){const id=name.slice(0,-4),r=enhanceUnit(data,id);validate(data,r.bytes);const normalized=normalizeFactionGlb(r.bytes);generated.push([name,normalized.bytes]);rows.push({id,file:name,bytes:normalized.bytes.length,addedTriangles:r.addedTriangles,sourceSha256:hash(data),sha256:hash(normalized.bytes)});}}
if(rows.length!==22||new Set(rows.map(r=>r.id)).size!==22)throw Error('Incomplete roster');mkdirSync(out,{recursive:true});for(const [name,data] of generated)writeFileSync(new URL(name,out),data);writeFileSync(new URL('manifest.json',out),JSON.stringify({status:'REVIEW_ONLY',importRevision:FACTION_IMPORT_REVISION,models:rows},null,2)+'\n');console.log('Validated',rows.length,'faction units',rows.reduce((a,b)=>a+b.addedTriangles,0),'additional triangles');
