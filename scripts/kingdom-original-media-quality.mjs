// Fail-closed validation of exact generated GLB and PCM binary payloads.
export function verifyOriginalKingdomMedia(entries, manifest) {
 const fail=(msg)=>{throw Error("KINGDOM ORIGINAL MEDIA GATE: "+msg)};
 const expected=["phan","quin","van","christian","lhen","ace","ellusur","jawo","mitch","niel","angel","vhen","trudice"];
 const modelEntries=entries.filter(x=>x.name.endsWith(".glb")),soundEntries=entries.filter(x=>x.name.endsWith(".wav"));
 if(modelEntries.length!==13||soundEntries.length!==20||manifest.heroes.length!==13||manifest.cues.length!==7||manifest.soundscapes.length!==13||new Set(entries.map(e=>e.name)).size!==33)fail("incomplete media");
 const report={models:0,bones:0,triangles:0,textures:0,clips:0,sounds:0,vertices:0,totalBytes:0};
 const decode=(a)=>String.fromCharCode(...a),names=new Set();
 const crc=(bytes)=>{let x=0xffffffff;for(const b of bytes){x^=b;for(let i=0;i<8;i++)x=(x>>>1)^((x&1)?0xedb88320:0)}return (x^0xffffffff)>>>0};
 for(const item of modelEntries){
  const b=item.bytes,v=new DataView(b.buffer,b.byteOffset,b.byteLength),name=item.name.split("/").at(-1).slice(0,-4);names.add(name);
  if(b.byteLength>4000000||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==b.length)fail(name+" GLB header");
  const len=v.getUint32(12,true);if(v.getUint32(16,true)!==0x4e4f534a)fail(name+" JSON");const j=JSON.parse(decode(b.subarray(20,20+len))),base=28+len;
  if(v.getUint32(base-4,true)!==0x004e4942||base+v.getUint32(base-8,true)!==b.length)fail(name+" BIN");
  if(j.skins.length!==1||j.meshes.length!==1||j.skins[0].joints.length<15||j.images.length!==12||j.animations.length!==5)fail(name+" incomplete rig");
  const joints=j.skins[0].joints.length,ib=j.accessors[j.skins[0].inverseBindMatrices];if(ib.count!==joints||ib.type!=="MAT4")fail(name+" inverse bind");
  const get=(ix,k)=>{const a=j.accessors[ix],view=j.bufferViews[a.bufferView],w=a.componentType===5123?2:4,off=base+(view.byteOffset||0)+k*w;if(off+w>base+view.byteOffset+view.byteLength)fail(name+" accessor overflow");return w===2?v.getUint16(off,true):v.getFloat32(off,true)};
  for(const bv of j.bufferViews)if(bv.byteOffset%4||bv.byteOffset+bv.byteLength>j.buffers[0].byteLength)fail(name+" buffer bounds");
  let blend=0,tri=0,vertex=0;
  for(const p of j.meshes[0].primitives){
   const attrs=p.attributes,n=j.accessors[attrs.POSITION].count;
   for(const k of ["NORMAL","TEXCOORD_0","TANGENT","COLOR_0","JOINTS_0","WEIGHTS_0"])if(j.accessors[attrs[k]]?.count!==n)fail(name+" missing "+k);
   for(let i=0;i<n;i++){let sum=0;for(let k=0;k<4;k++){const weight=get(attrs.WEIGHTS_0,i*4+k);if(!Number.isFinite(weight)||weight<0||get(attrs.JOINTS_0,i*4+k)>=joints)fail(name+" weight");sum+=weight;}if(Math.abs(sum-1)>1e-5)fail(name+" normalization");if(get(attrs.WEIGHTS_0,i*4+1)>0)blend++;
    let norm=0,tan=0,dot=0;for(let k=0;k<3;k++){const a=get(attrs.NORMAL,i*3+k),c=get(attrs.TANGENT,i*4+k);if(!Number.isFinite(get(attrs.POSITION,i*3+k)))fail(name+" position");norm+=a*a;tan+=c*c;dot+=a*c;}if(Math.abs(norm-1)>1e-4||Math.abs(tan-1)>1e-4||Math.abs(dot)>1e-4)fail(name+" normal/tangent");
   }
   const count=j.accessors[p.indices].count;if(count%3)fail(name+" index count");
   for(let i=0;i<count;i+=3){const a=get(p.indices,i),c=get(p.indices,i+1),d=get(p.indices,i+2);if(a>=n||c>=n||d>=n||a===c||a===d||c===d)fail(name+" index range");const u=[0,1,2].map(k=>get(attrs.POSITION,c*3+k)-get(attrs.POSITION,a*3+k)),w=[0,1,2].map(k=>get(attrs.POSITION,d*3+k)-get(attrs.POSITION,a*3+k));const area=Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]);if(!Number.isFinite(area)||area<1e-10)fail(name+" degenerate triangle");}
   tri+=count/3;vertex+=n;
  }
  if(blend<500||tri<14000||vertex<9000)fail(name+" detail floor");
  const clipNames=["Idle","Walk","Run","Interact","Celebrate"];
  for(const [index,clip] of j.animations.entries()){
   if(clip.name!==clipNames[index]||clip.channels.length<14)fail(name+" missing animation");
   for(const channel of clip.channels){const s=clip.samplers[channel.sampler],n=j.accessors[s.input].count;if(n<25||j.accessors[s.output].count!==n)fail(name+" keys");
    for(let k=1;k<n;k++)if(!(get(s.input,k)>get(s.input,k-1)))fail(name+" unordered animation");
    if(channel.target.path==="rotation")for(let k=0;k<n;k++){let mag=0;for(let l=0;l<4;l++)mag+=get(s.output,k*4+l)**2;if(Math.abs(mag-1)>1e-4)fail(name+" quaternion");}
    if(index<3){const width=channel.target.path==="rotation"?4:3;for(let k=0;k<width;k++)if(Math.abs(get(s.output,k)-get(s.output,(n-1)*width+k))>1e-4)fail(name+" loop seam");}
   }
  }
  for(const im of j.images){const view=j.bufferViews[im.bufferView],off=base+view.byteOffset,end=off+view.byteLength;if(v.getUint32(off,false)!==0x89504e47||v.getUint32(off+4,false)!==0x0d0a1a0a||v.getUint32(off+16,false)!==96||v.getUint32(off+20,false)!==96)fail(name+" PNG");let at=off+8,closed=false;while(at<end){const n=v.getUint32(at,false),stop=at+n+12;if(stop>end||crc(b.subarray(at+4,stop-4))!==v.getUint32(stop-4,false))fail(name+" PNG CRC");if(decode(b.subarray(at+4,at+8))==="IEND")closed=true;at=stop;}if(!closed||at!==end)fail(name+" PNG terminator");}
  report.models++;report.bones+=joints;report.triangles+=tri;report.vertices+=vertex;report.textures+=j.images.length;report.clips+=j.animations.length;report.totalBytes+=b.length;
 }
 if(expected.some(id=>!names.has(id)))fail("wrong character roster");
 if(new Set(manifest.heroes.map(h=>h.outfit)).size!==13||manifest.heroes.some(h=>typeof h.outfit!=="string"||!h.outfit))fail("missing unique costume geometry");
 for(const item of soundEntries){const b=item.bytes,v=new DataView(b.buffer,b.byteOffset,b.byteLength);if(decode(b.subarray(0,4))!=="RIFF"||v.getUint32(4,true)!==b.length-8||v.getUint16(22,true)!==2||v.getUint32(24,true)!==44100||v.getUint16(34,true)!==16||v.getUint32(40,true)!==b.length-44)fail(item.name+" WAV");let peak=0,stereo=0;for(let i=44;i<b.length;i+=4){const l=v.getInt16(i,true),r=v.getInt16(i+2,true);peak=Math.max(peak,Math.abs(l),Math.abs(r));if(l!==r)stereo++;}
  if(peak<500||peak>=32767||stereo<100)fail(item.name+" audio signal");
  if(item.name.includes("/ambience/")&&(Math.abs(v.getInt16(44,true)-v.getInt16(b.length-4,true))>=2600||Math.abs(v.getInt16(46,true)-v.getInt16(b.length-2,true))>=2600))fail(item.name+" loop discontinuity");
  report.sounds++;report.totalBytes+=b.length;
 }
 if(report.totalBytes>64*1024*1024)fail("media budget exceeded");
 return report;
}
