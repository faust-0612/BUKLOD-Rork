// Original BUKLOD authored procedural 3D and audio. No third-party character mesh, image atlas or paid service.
export const HERO_DESIGNS = Object.freeze({
  "phan": [
    "#395f4a",
    "#b89352",
    "#482c20",
    1.04,
    "ledger",
    0
  ],
  "quin": [
    "#284d72",
    "#a9c9dd",
    "#2f2426",
    1.02,
    "compass",
    1
  ],
  "van": [
    "#226d76",
    "#c0cdd0",
    "#262f37",
    1.08,
    "signal",
    2
  ],
  "christian": [
    "#523e74",
    "#e4bc68",
    "#402b20",
    1.09,
    "book",
    3
  ],
  "lhen": [
    "#78487a",
    "#f0b8c5",
    "#542c32",
    0.93,
    "lute",
    4
  ],
  "ace": [
    "#315b64",
    "#c7d9da",
    "#252b29",
    1.12,
    "shield",
    5
  ],
  "ellusur": [
    "#657a45",
    "#e0c9a0",
    "#524032",
    1.1,
    "hammer",
    6
  ],
  "jawo": [
    "#315744",
    "#9fcd84",
    "#3a291e",
    1.01,
    "staff",
    7
  ],
  "mitch": [
    "#884c64",
    "#f6cda9",
    "#472c38",
    0.96,
    "palette",
    8
  ],
  "niel": [
    "#80583a",
    "#d9ac6f",
    "#322821",
    1.06,
    "lantern",
    9
  ],
  "angel": [
    "#7b6530",
    "#f1dd9b",
    "#56402b",
    0.98,
    "chest",
    10
  ],
  "vhen": [
    "#497c4c",
    "#d0c57b",
    "#403125",
    1.03,
    "harvest",
    11
  ],
  "trudice": [
    "#745999",
    "#ecc4e0",
    "#51364c",
    0.87,
    "blossom",
    12
  ]
});
export function originalTexturePNG(kind,mode,variant,size=96){
 const tau=2*Math.PI,raw=new Uint8Array(size*(size*3+1));let seed=(variant+1)*374761393;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const h=new Float32Array(size*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){let u=x/size,v=y/size;
  const grain=rand()-.5,warp=Math.sin(tau*(u*24))*Math.cos(tau*(v*24));
  const braid=Math.sin(tau*(u*6+v*8))*Math.sin(tau*(u*6-v*8));
  const engraved=Math.pow(Math.max(0,Math.sin(tau*(u*3+v*2))*Math.cos(tau*(u*3-v*2))),7);
  const pores=Math.max(0,Math.sin(tau*u*17+.8*Math.sin(tau*v*9))*Math.cos(tau*v*19));
  h[y*size+x]=kind==="cloth"? .5+.17*warp+.12*braid+.035*grain:kind==="metal"? .5+.14*engraved+.025*grain:.5+.13*pores+.045*grain;
 }
 const clamp=x=>Math.max(0,Math.min(255,Math.round(x)));
 const px=(x,y)=>h[((y+size)%size)*size+(x+size)%size];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const q=y*(size*3+1)+1+x*3,v=px(x,y);if(mode==="normal"){let dx=(px(x+1,y)-px(x-1,y))*.48,dy=(px(x,y+1)-px(x,y-1))*.48,l=Math.hypot(dx,dy,1);raw[q]=clamp(127.5+127.5*(-dx/l));raw[q+1]=clamp(127.5+127.5*(-dy/l));raw[q+2]=clamp(127.5+127.5/l);}else if(mode==="orm"){raw[q]=clamp(225+30*v);raw[q+1]=clamp((kind==="metal"?0.76:0.86)+(v-.5)*.19>1?255:255*((kind==="metal"?0.76:0.86)+(v-.5)*.19));raw[q+2]=kind==="metal"?255:0;}else{const color=clamp((kind==="metal"?224:211)+58*v);raw[q]=color;raw[q+1]=color;raw[q+2]=color;}}
 const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0};
 const be=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255];
 const chunk=(type,payload)=>{const body=[...type.split("").map(c=>c.charCodeAt(0)),...payload];return [...be(payload.length),...body,...be(crc32(body))]};
 const z=[0x78,0x01];let a=1,b=0;for(const byte of raw){a=(a+byte)%65521;b=(b+a)%65521;}
 for(let off=0;off<raw.length;){const n=Math.min(65535,raw.length-off),last=off+n===raw.length;z.push(last?1:0,n&255,n>>>8,(~n)&255,((~n)>>>8)&255);for(let i=0;i<n;i++)z.push(raw[off+i]);off+=n;}
 z.push(...be(((b<<16)|a)>>>0));
 return new Uint8Array([137,80,78,71,13,10,26,10,...chunk("IHDR",[...be(size),...be(size),8,2,0,0,0]),...chunk("IDAT",z),...chunk("IEND",[])]);
}
export function createOriginalHero(id, d) {
 const [primary,trim,hair,height,prop,variant]=d;
 const TAU=2*Math.PI, mats=[], meshes=[], nodes=[], anims=[], views=[], access=[], bin=[],images=[],textures=[];
 const hex=x=>[parseInt(x.slice(1,3),16)/255,parseInt(x.slice(3,5),16)/255,parseInt(x.slice(5,7),16)/255,1].map((v,i)=>i<3?Math.pow(v,2.2):v);
 const material=(name,color,metallic=0,roughness=.65)=>{mats.push({name,pbrMetallicRoughness:{baseColorFactor:hex(color),metallicFactor:metallic,roughnessFactor:roughness},doubleSided:false});return mats.length-1};
 const cloth=material("Dyed fabric",primary,0,.85),metal=material("Engraved metal",trim,.66,.32),leather=material("Leather","#302b30",0,.8),skin=material("Skin","#c89577",0,.75),hairM=material("Hair",hair,0,.76),white=material("Eye ivory","#f1e7d9"),ink=material("Eye iris","#252a35"),accent=material("Gem",trim,.32,.23),dark=material("Undertunic","#17232c");
 const addBytes=(arr,type)=>{while(bin.length%4)bin.push(0);const start=bin.length, bytes=new Uint8Array(arr.length*(type===5123?2:4)),dv=new DataView(bytes.buffer);for(let i=0;i<arr.length;i++){if(type===5123)dv.setUint16(i*2,arr[i],true);else dv.setFloat32(i*4,arr[i],true)}for(const b of bytes)bin.push(b);views.push({buffer:0,byteOffset:start,byteLength:bytes.length});return views.length-1};
 const appendImage=(bytes,name)=>{while(bin.length%4)bin.push(0);const offset=bin.length;for(const b of bytes)bin.push(b);views.push({buffer:0,byteOffset:offset,byteLength:bytes.length});images.push({name,mimeType:"image/png",bufferView:views.length-1});textures.push({source:images.length-1,sampler:0});return textures.length-1;};
 const ac=(arr,type,shape,min,max)=>{const n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[shape];const item={bufferView:addBytes(arr,type),componentType:type,count:arr.length/n,type:shape};if(min)item.min=min;if(max)item.max=max;access.push(item);return access.length-1};
 for(const [mat,kind] of [[cloth,"cloth"],[leather,"leather"],[metal,"metal"],[dark,"cloth"]]){const normal=appendImage(originalTexturePNG(kind,"normal",variant),kind+"_normal");const albedo=appendImage(originalTexturePNG(kind,"albedo",variant),kind+"_albedo");const orm=appendImage(originalTexturePNG(kind,"orm",variant),kind+"_orm");mats[mat].pbrMetallicRoughness.baseColorTexture={index:albedo};mats[mat].pbrMetallicRoughness.metallicRoughnessTexture={index:orm};mats[mat].normalTexture={index:normal,scale:kind==="metal"?.46:.7};mats[mat].occlusionTexture={index:orm,strength:.38};}
 const node=(name,t,parent)=>{const n={name,translation:t,children:[]};nodes.push(n);const i=nodes.length-1;if(parent>=0)nodes[parent].children.push(i);return i};
 const root=node(id,[0,0,0],-1), pelvis=node("Pelvis",[0,.90*height,0],root),torso=node("Spine",[0,.22*height,0],pelvis),head=node("Head",[0,.47*height,0],torso);
 const joints={};
 const geoms=new Map();
 const parents=new Map();
 const bindPositions=()=>{const positions=[];for(let i=0;i<nodes.length;i++){const parent=nodes.findIndex(n=>n.children?.includes(i));parents.set(i,parent);const t=nodes[i].translation;positions.push(t.map((v,k)=>v+(parent<0?0:positions[parent][k])));}return positions;};
 function ell(j,m,c,s,segments=16,rings=10,tilt=0){
  const key=j+":"+m;let g=geoms.get(key);if(!g){g={p:[],n:[],uv:[],tan:[],i:[],j,m};geoms.set(key,g)}
  const off=g.p.length/3,cs=Math.cos(tilt),sn=Math.sin(tilt);
  for(let iy=0;iy<=rings;iy++){const th=Math.PI*iy/rings,sy=Math.cos(th),sr=Math.sin(th);for(let ix=0;ix<=segments;ix++){const a=TAU*ix/segments,x=sr*Math.cos(a),y=sy,z=sr*Math.sin(a);const px=x*s[0],py=y*s[1];g.p.push(c[0]+px*cs-py*sn,c[1]+px*sn+py*cs,c[2]+z*s[2]);let nx=x/s[0],ny=y/s[1],nz=z/s[2],l=Math.hypot(nx,ny,nz)||1;g.n.push((nx*cs-ny*sn)/l,(nx*sn+ny*cs)/l,nz/l);g.uv.push(ix/segments,iy/rings);let tx=-Math.sin(a)*s[0],tz=Math.cos(a)*s[2],tl=Math.hypot(tx,tz)||1;g.tan.push(tx*cs/tl,tx*sn/tl,tz/tl,1);}}
  for(let iy=0;iy<rings;iy++)for(let ix=0;ix<segments;ix++){const a=off+iy*(segments+1)+ix,b=a+segments+1;if(iy>0)g.i.push(a,a+1,b);if(iy<rings-1)g.i.push(a+1,b+1,b);}
 }
 // Fully modeled volumes: articulated body, sculpted face, fitted garments,
 // separate metal trims, boots, gloves and role-specific silhouette pieces.
 ell(pelvis,cloth,[0,0,0],[.26,.20,.17]);ell(torso,dark,[0,.03,0],[.27,.32,.17]);ell(torso,cloth,[0,.13,0],[.34,.29,.205]);
 ell(torso,metal,[0,.12,.185],[.17,.19,.034],12,8);ell(torso,accent,[0,.15,.221],[.055,.065,.024],10,7);
 const shoulderShape=[.10,.08,.13,.15,.07,.19,.14,.085,.075,.11,.12,.09,.065][variant];
 for(let s of [-1,1])ell(torso,cloth,[s*.26,.24,-.09],[shoulderShape,.24+(variant%5)*.024,.12],16,10,s*.16);
 if([1,3,7,9,10].includes(variant)){ell(torso,cloth,[0,-.13,-.16],[.29,.41+(variant%3)*.08,.085],18,12);for(let s of [-1,1])ell(torso,metal,[s*.23,-.10,-.18],[.032,.36,.04],10,9,s*.10);}
 if([0,6,11].includes(variant)){ell(pelvis,leather,[.28,-.11,-.01],[.13,.17,.14],14,9);ell(pelvis,metal,[.28,-.06,.11],[.06,.045,.025],12,6);}
 if(variant===4||variant===8||variant===12){for(let s of [-1,1])ell(torso,accent,[s*.19,.19,.17],[.04,.11,.034],10,7,s*.6);}
 ell(pelvis,leather,[0,.02,0],[.28,.057,.19]);ell(pelvis,metal,[0,.02,.184],[.095,.056,.035],12,6);
 // Asymmetric coat tails and embroidered collar; real geometry instead of flat art.
 for(let s of [-1,1]){ell(pelvis,cloth,[s*.17,-.15,-.018],[.135,.29+(variant%3)*.025,.13],14,9,s*.13);ell(torso,metal,[s*.23,.35,.05],[.11,.055,.105],12,7,s*.27);}
 const facial=[.95,1.03,1.02,1.05,.92,1.08,1.04,.97,.94,1.02,.98,1.01,.91][variant];
 ell(head,skin,[0,.12,0],[.175*facial,.205,.166],32,20);
 ell(head,skin,[0,.035,.075],[.136*facial,.105,.114],22,14);
 for(let s of [-1,1])ell(head,skin,[s*.101,.101,.106],[.076,.069,.054],16,10,s*.12);
 ell(head,skin,[0,.093,.162],[.045,.052,.042],12,8);
 ell(head,skin,[0,.015,.144],[.079,.034,.027],16,10);
 const lips=material("Lip tone","#80504a",0,.72);
 ell(head,lips,[0,.012,.170],[.055,.009,.009],16,6);
 for(let s of [-1,1]){ell(head,skin,[s*.172,.105,0],[.035,.07,.032],12,8);ell(head,white,[s*.073,.15,.139],[.045,.026,.018],12,6);ell(head,ink,[s*.07,.15,.156],[.018,.02,.009],10,6);ell(head,hairM,[s*.073,.188,.139],[.051,.012,.012],10,5,s*.10);}
 ell(head,hairM,[0,.23,-.032],[.191,.14,.17],20,12);
 for(let i=0;i<5;i++)ell(head,hairM,[(i-2)*.065,.248+(i%2)*.025,.095],[.055,.085+(variant%4)*.012,.08],12,8,-.35+i*.13);
 if(variant%4===0||variant%4===3){ell(head,metal,[0,.28,0],[.20,.047,.17],18,7);ell(head,accent,[0,.294,.154],[.05,.08,.033],10,7);}
 if(variant%4===1){ell(head,cloth,[0,.27,-.03],[.22,.12,.19],18,10);ell(head,metal,[0,.225,.11],[.195,.028,.04],16,7);}
 if(variant%4===2){for(let s of [-1,1])ell(head,hairM,[s*.145,.08,-.09],[.065,.19,.085],14,10,s*.16);}
 for(const s of [-1,1]){
  const side=s<0?"L":"R";
  const sh=node("Shoulder"+side,[s*.34,.22,0],torso),el=node("Elbow"+side,[0,-.245,0],sh),hand=node("Hand"+side,[0,-.235,0],el);
  const hip=node("Hip"+side,[s*.145,-.1,0],pelvis),knee=node("Knee"+side,[0,-.37*height,0],hip),foot=node("Foot"+side,[0,-.32*height,0],knee);
  joints["sh"+side]=sh;joints["el"+side]=el;joints["hip"+side]=hip;joints["knee"+side]=knee;joints["foot"+side]=foot;joints["hand"+side]=hand;
  ell(sh,cloth,[0,-.105,0],[.105,.19,.106]);ell(sh,metal,[s*.025,.025,.01],[.15+(variant%3)*.012,.095,.14],14,9,s*.2);
  ell(el,leather,[0,-.10,0],[.081,.158,.08]);ell(el,metal,[0,-.07,.062],[.072,.11,.042],12,8);
  ell(hand,skin,[0,-.035,0],[.061,.09,.055],16,10);
  for(let finger=0;finger<4;finger++)ell(hand,skin,[(finger-1.5)*.024,-.102,.012],[.013,.047-(finger===3?.009:0),.015],10,7);ell(hand,skin,[-s*.056,-.035,.023],[.018,.04,.021],10,7,s*.46);
  ell(hip,dark,[0,-.17,0],[.115,.24,.12]);ell(knee,leather,[0,-.14,0],[.09,.20,.10]);ell(knee,metal,[0,.01,.077],[.09,.078,.047],12,7);
  ell(foot,leather,[0,-.015,.065],[.107,.078,.17],16,9);ell(foot,metal,[0,-.015,.179],[.096,.05,.065],12,7);
  if(s===1){
   const held=node("Signature_"+prop,[0,-.025,.07],hand);
   if(["staff","signal","hammer","harvest"].includes(prop)){ell(held,leather,[0,-.18,0],[.035,.39,.035],10,8);ell(held,metal,[0,.19,0],[prop==="hammer"?.18:.12,prop==="hammer"?.068:.15,.085],12,9);ell(held,accent,[0,.28,0],[.065,.07,.064],10,8);if(prop==="harvest"){for(let k=0;k<5;k++)ell(held,accent,[(k-2)*.035,.28+(k%2)*.08,0],[.025,.10,.027],10,7,(k-2)*.23);}if(prop==="signal"){for(let k=0;k<3;k++)ell(held,accent,[0,.20+k*.065,.07],[.10-k*.023,.024,.024],12,6);}if(prop==="staff"){ell(held,metal,[0,.36,0],[.11,.045,.07],14,7);}}
   else if(prop==="shield"){ell(held,metal,[.11,-.05,.02],[.21,.27,.055],20,12);ell(held,cloth,[.11,-.05,.07],[.16,.21,.027],16,10);ell(held,accent,[.11,-.05,.10],[.06,.07,.03],12,8);}
   else if(prop==="lute"){ell(held,leather,[.05,-.10,0],[.16,.21,.07],18,12);ell(held,metal,[.05,.14,0],[.037,.20,.04],10,8);ell(held,ink,[.05,-.1,.065],[.045,.05,.02],12,8);}
   else if(prop==="lantern"||prop==="blossom"){ell(held,metal,[0,.03,0],[.12,.13,.095],12,9);ell(held,accent,[0,.03,.06],[.075,.095,.05],12,9);for(let n=0;n<5;n++){let a=n*TAU/5;ell(held,accent,[.10*Math.cos(a),.10*Math.sin(a)+.04,.06],[.046,.046,.035],8,6);}}
   else if(prop==="compass"){ell(held,metal,[.035,0,0],[.145,.145,.055],24,12);ell(held,ink,[.035,0,.052],[.12,.12,.02],20,10);ell(held,accent,[.035,0,.077],[.018,.107,.015],10,8,.74);}
   else if(prop==="palette"){ell(held,leather,[.035,-.04,0],[.19,.115,.04],20,10,.5);for(let k=0;k<5;k++){let a=k*TAU/5;ell(held,k%2?accent:cloth,[.035+.11*Math.cos(a),-.04+.07*Math.sin(a),.038],[.027,.024,.019],8,6);}}
   else if(prop==="chest"){ell(held,leather,[.03,-.07,0],[.175,.13,.105],14,9);ell(held,metal,[.03,.012,0],[.18,.045,.105],12,7);for(let s of [-1,1])ell(held,metal,[.03+s*.1,-.05,.09],[.023,.11,.024],10,7);}
   else if(prop==="book"){for(let s of [-1,1]){ell(held,leather,[.035+s*.085,-.045,0],[.10,.16,.035],14,9,s*.2);ell(held,white,[.035+s*.085,-.045,.032],[.09,.14,.018],12,8,s*.2);}}
   else {ell(held,leather,[.035,-.045,0],[.13,.18,.045],12,9);for(let k=0;k<3;k++)ell(held,metal,[.035,-.13+k*.065,.046],[.105,.015,.017],10,5);}
  }
 }
 // Convert authored surfaces into one true skinned mesh grouped by material.
 // Bind poses are global translations; clothing near joints blends with the parent,
 // while metal trims, held tools and face features retain rigid bone attachment.
 const bind=bindPositions(),boneIds=nodes.map((_,i)=>i).filter(i=>i!==root),boneIndex=new Map(boneIds.map((id,i)=>[id,i]));
 const batches=new Map();
 const colorFor=(mat,u,v)=>{const pattern=.5+.5*Math.sin(u*TAU*12)*Math.sin(v*TAU*17),grain=.5+.5*Math.sin(u*TAU*37+v*TAU*19);let light=mat===cloth?.82+.13*pattern+.05*grain:mat===leather?.80+.13*grain:mat===metal?.86+.14*pattern:.94+.06*grain;return [light,light,light,1]};
 for(const g of geoms.values()){
  let b=batches.get(g.m);if(!b){b={p:[],n:[],uv:[],tan:[],c:[],j:[],w:[],i:[]};batches.set(g.m,b);}
  const offset=b.p.length/3,parent=parents.get(g.j),joint=boneIndex.get(g.j),parentJoint=boneIndex.get(parent)??joint;
  const name=nodes[g.j].name,soft=(g.m===cloth||g.m===leather||g.m===dark)&&/^(Shoulder|Elbow|Hip|Knee)/.test(name);
  for(let k=0;k<g.p.length/3;k++){
   const q=g.p.slice(k*3,k*3+3),u=g.uv[k*2],v=g.uv[k*2+1];
   b.p.push(...q.map((x,axis)=>x+bind[g.j][axis]));b.n.push(...g.n.slice(k*3,k*3+3));b.uv.push(u,v);b.tan.push(...g.tan.slice(k*4,k*4+4));b.c.push(...colorFor(g.m,u,v));
   const parentWeight=soft?Math.max(0,Math.min(.46,(q[1]+.055)*3.5)):0;
   b.j.push(joint,parentJoint,0,0);b.w.push(1-parentWeight,parentWeight,0,0);
  }
  for(const idx of g.i)b.i.push(idx+offset);
 }
 const primitives=[];
 for(const [mat,b] of batches){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let k=0;k<b.p.length;k++){const axis=k%3;min[axis]=Math.min(min[axis],b.p[k]);max[axis]=Math.max(max[axis],b.p[k]);}
  if(b.p.length/3>=65536)throw Error("Kingdom material index overflow");
  primitives.push({attributes:{POSITION:ac(b.p,5126,"VEC3",min,max),NORMAL:ac(b.n,5126,"VEC3"),TEXCOORD_0:ac(b.uv,5126,"VEC2"),TANGENT:ac(b.tan,5126,"VEC4"),COLOR_0:ac(b.c,5126,"VEC4"),JOINTS_0:ac(b.j,5123,"VEC4"),WEIGHTS_0:ac(b.w,5126,"VEC4")},indices:ac(b.i,5123,"SCALAR",[0],[Math.max(...b.i)]),material:mat});
 }
 meshes.push({name:id+"_SkinnedGeometry",primitives});
 const inverseBind=boneIds.flatMap(id=>{const [x,y,z]=bind[id];return [1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1];});
 const skinIndex=ac(inverseBind,5126,"MAT4");
 const skinNode=node(id+"_SkinnedMesh",[0,0,0],root);nodes[skinNode].mesh=0;nodes[skinNode].skin=0;
 let floor=Infinity;for(const b of batches.values())for(let k=1;k<b.p.length;k+=3)floor=Math.min(floor,b.p[k]);nodes[root].translation[1]=-floor;
 const quat=(x,y,z)=>{const sx=Math.sin(x/2),cx=Math.cos(x/2),sy=Math.sin(y/2),cy=Math.cos(y/2),sz=Math.sin(z/2),cz=Math.cos(z/2);return [sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz]};
 for(const [name,dur] of [["Idle",2.4],["Walk",.92],["Run",.64],["Interact",1.1],["Celebrate",1.4]]){
  const times=Array.from({length:25},(_,i)=>dur*i/24),input=ac(times,5126,"SCALAR",[0],[dur]),samplers=[],channels=[];
  const track=(joint,fn)=>{const output=ac(times.flatMap((_,i)=>quat(...fn(i/24))),5126,"VEC4");samplers.push({input,output,interpolation:"LINEAR"});channels.push({sampler:samplers.length-1,target:{node:joint,path:"rotation"}})};
  const gait=name==="Walk"||name==="Run",amp=name==="Run"?.68:.36;
  const bob=times.flatMap((_,i)=>{const t=i/24;return [0,.90*height+(gait?.024*(1-Math.cos(t*TAU*2)):name==="Celebrate"?.055*Math.sin(Math.PI*t):.009*Math.sin(t*TAU)),0]});const bobOut=ac(bob,5126,"VEC3");samplers.push({input,output:bobOut,interpolation:"LINEAR"});channels.push({sampler:samplers.length-1,target:{node:pelvis,path:"translation"}});
  for(const side of ["L","R"]){const sign=side==="L"?1:-1;track(joints["hip"+side],t=>[gait?amp*Math.sin(t*TAU)*sign:0,0,0]);track(joints["knee"+side],t=>[gait?Math.max(0,-Math.sin(t*TAU)*sign)*.62:0,0,0]);track(joints["foot"+side],t=>[gait?-.15*Math.sin(t*TAU+.4)*sign:0,0,0]);track(joints["hand"+side],t=>[name==="Interact"?.12*Math.sin(Math.PI*t):0,0,gait?.025*Math.sin(t*TAU)*sign:0]);track(joints["sh"+side],t=>[gait?-amp*.7*Math.sin(t*TAU)*sign:name==="Interact"&&side==="R"?-.9*Math.sin(Math.PI*t):name==="Celebrate"?-.9*Math.sin(Math.PI*t):.035*Math.sin(t*TAU),0,sign*(.12+(name==="Celebrate"?.65*Math.sin(Math.PI*t):0))]);track(joints["el"+side],t=>[gait?-.18-.16*Math.max(0,Math.sin(t*TAU)*sign):name==="Interact"?-.65*Math.sin(Math.PI*t):-.12,0,0]);}
  track(torso,t=>[gait?.04:0,gait?.055*Math.sin(t*TAU):.03*Math.sin(t*TAU),0]);track(head,t=>[name==="Interact"?.12*Math.sin(Math.PI*t):.025*Math.sin(t*TAU),.05*Math.sin(t*TAU),0]);anims.push({name,samplers,channels});
 }
 for(const n of nodes)if(!n.children.length)delete n.children;
 const doc={asset:{version:"2.0",generator:"BUKLOD Original Living Kingdom Skinned Mesh Workshop v2"},scene:0,scenes:[{nodes:[root]}],nodes,meshes,skins:[{name:id+"_Skeleton",joints:boneIds,skeleton:pelvis,inverseBindMatrices:skinIndex}],materials:mats,images,textures,samplers:[{magFilter:9729,minFilter:9987,wrapS:10497,wrapT:10497}],animations:anims,buffers:[{byteLength:bin.length}],bufferViews:views,accessors:access};
 const json=JSON.stringify(doc),jb=Array.from(json,c=>c.charCodeAt(0));while(jb.length%4)jb.push(32);while(bin.length%4)bin.push(0);
 const bytes=new Uint8Array(12+8+jb.length+8+bin.length),dv=new DataView(bytes.buffer);dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,bytes.length,true);dv.setUint32(12,jb.length,true);dv.setUint32(16,0x4e4f534a,true);bytes.set(jb,20);const o=20+jb.length;dv.setUint32(o,bin.length,true);dv.setUint32(o+4,0x004e4942,true);bytes.set(bin,o+8);
 return {bytes,meta:{id,meshes:meshes.length,primitives:primitives.length,bones:boneIds.length,textures:textures.length,vertices:[...geoms.values()].reduce((s,g)=>s+g.p.length/3,0),triangles:[...geoms.values()].reduce((s,g)=>s+g.i.length/3,0),nodes:nodes.length,clips:anims.map(x=>x.name),prop}};
}
export function createOriginalCue(id,index){
 const rate=44100,dur=id==="complete"?2.4:id==="ambience"?8:id==="footstep"?.28:1.15,n=Math.floor(rate*dur),samples=new Float64Array(n);let seed=1234567+index*991,low=0,slow=0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1};
 const notes=id==="complete"?[261.63,329.63,392,523.25]:id==="discover"?[392,523.25,659.25]:id==="guide"?[329.63,392]:id==="start"?[196,293.66,392]:[220,330,440];
 for(let i=0;i<n;i++){const t=i/rate,r=rand();low=.91*low+.09*r;slow=.997*slow+.003*r;let v=0;
 if(id==="footstep"){v=(low*.8+Math.sin(2*Math.PI*(110*t-55*t*t))*0.18)*Math.exp(-t*19);}
 else if(id==="ambience"){const env=Math.sin(Math.PI*t/dur)**2;v=env*(slow*1.8+low*.12+.026*Math.sin(2*Math.PI*110*t)+.018*Math.sin(2*Math.PI*164.8*t));}
 else{for(let j=0;j<notes.length;j++){const x=t-j*(id==="complete"?.17:.12);if(x<0)continue;const e=Math.min(1,x*90)*Math.exp(-x*(id==="complete"?2.1:5));const hz=notes[j];v+=e*(.19*Math.sin(2*Math.PI*hz*x)+.075*Math.sin(2*Math.PI*hz*2.01*x)*Math.exp(-x*3)+.038*Math.sin(2*Math.PI*hz*3.97*x)*Math.exp(-x*8));}v+=low*.05*Math.exp(-t*7);}
 samples[i]=v*Math.min(1,t*120)*Math.min(1,(dur-t)*35);}
 const pcm=new Uint8Array(44+n*4),dv=new DataView(pcm.buffer),str=(o,s)=>{for(let i=0;i<s.length;i++)pcm[o+i]=s.charCodeAt(i)};str(0,"RIFF");dv.setUint32(4,pcm.length-8,true);str(8,"WAVE");str(12,"fmt ");dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,2,true);dv.setUint32(24,rate,true);dv.setUint32(28,rate*4,true);dv.setUint16(32,4,true);dv.setUint16(34,16,true);str(36,"data");dv.setUint32(40,n*4,true);
 let peak=0;for(const v of samples)peak=Math.max(peak,Math.abs(v));const scale=.72/Math.max(.05,peak*1.32);for(let i=0;i<n;i++){const v=samples[i],delay=samples[Math.max(0,i-383)],a=(v+.16*delay)*scale,b=(v+.12*samples[Math.max(0,i-521)])*scale;dv.setInt16(44+i*4,Math.round(Math.max(-.95,Math.min(.95,a))*32767),true);dv.setInt16(46+i*4,Math.round(Math.max(-.95,Math.min(.95,b))*32767),true);}
 return {bytes:pcm,meta:{id,seconds:dur,sampleRate:rate,channels:2,source:"original procedural layered synthesis"}};
}
export const CUE_IDS = Object.freeze(["start","discover","guide","complete","footstep","ambience","return"]);
export const REALM_AMBIENCE_PROFILES = Object.freeze({
  "phan": [
    0.5,
    0.18,
    0.04,
    2
  ],
  "quin": [
    0.9,
    0.04,
    0.02,
    3
  ],
  "van": [
    0.24,
    0.1,
    0.13,
    5
  ],
  "christian": [
    0.25,
    0.07,
    0.08,
    1
  ],
  "lhen": [
    0.32,
    0.13,
    0.08,
    7
  ],
  "ace": [
    0.7,
    0.06,
    0.05,
    4
  ],
  "ellusur": [
    0.43,
    0.12,
    0.05,
    6
  ],
  "jawo": [
    0.25,
    0.3,
    0.15,
    2
  ],
  "mitch": [
    0.31,
    0.06,
    0.06,
    8
  ],
  "niel": [
    0.63,
    0.1,
    0.07,
    3
  ],
  "angel": [
    0.28,
    0.04,
    0.025,
    6
  ],
  "vhen": [
    0.38,
    0.25,
    0.2,
    5
  ],
  "trudice": [
    0.26,
    0.27,
    0.12,
    9
  ]
});
export function createRealmAmbience(id,profile) {
 const rate=44100,dur=8,n=rate*dur,fade=Math.floor(rate/5),[wind,birds,water,mode]=profile;
 const left=new Float32Array(n+fade),right=new Float32Array(n+fade);
 let seed=(1103515245+mode*3299+id.split("").reduce((a,c)=>a+c.charCodeAt(0)*97,0))>>>0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1};
 const tau=2*Math.PI;let low=0,mid=0,fluid=0,sidewind=0;const calls=Array.from({length:6},(_,i)=>({start:.5+i*1.13+random()*.22,freq:1500+mode*57+i*92+random()*140,pan:random()*.85}));
 for(let i=0;i<n+fade;i++){const t=i/rate,r=random();low=.9984*low+.0016*r;mid=.981*mid+.019*r;fluid=.86*fluid+.14*r;sidewind=.989*sidewind+.011*random();
  const drift=.64+.23*Math.sin(tau*t/4+mode)+.1*Math.sin(tau*t/2);
  let base=wind*(low*1.15+mid*.21)*drift;
  base+=water*(mid*.27+fluid*.12)*(.7+.3*Math.sin(tau*t/1.6+mode));
  const root=48+mode*4;const harm=.018*(Math.sin(tau*root*t)+.3*Math.sin(tau*(root*1.5)*t));
  let l=base+harm+sidewind*.04*wind,rch=base+harm-sidewind*.04*wind;
  for(const c of calls){const d=t-c.start;if(d>=0&&d<.26){const en=Math.sin(Math.PI*d/.26)**2;const sweep=tau*(c.freq*d+170*Math.sin(d*15)*d);const q=birds*.11*en*(Math.sin(sweep)+.15*Math.sin(sweep*2));l+=q*(.7-.3*c.pan);rch+=q*(.7+.3*c.pan);}}
  left[i]=l;right[i]=rch;
 }
 // Crossfade extra tail into head; continuous sound without a silent gap.
 for(let i=0;i<fade;i++){const x=i/(fade-1),gain=.5-.5*Math.cos(Math.PI*x);left[i]=left[n+i]*(1-gain)+left[i]*gain;right[i]=right[n+i]*(1-gain)+right[i]*gain;}
 let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
 const gain=.53/Math.max(.018,peak);
 const bytes=new Uint8Array(44+n*4),d=new DataView(bytes.buffer),str=(o,s)=>{for(let i=0;i<s.length;i++)bytes[o+i]=s.charCodeAt(i)};
 str(0,"RIFF");d.setUint32(4,bytes.length-8,true);str(8,"WAVE");str(12,"fmt ");d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,2,true);d.setUint32(24,rate,true);d.setUint32(28,rate*4,true);d.setUint16(32,4,true);d.setUint16(34,16,true);str(36,"data");d.setUint32(40,n*4,true);
 for(let i=0;i<n;i++){d.setInt16(44+i*4,Math.round(left[i]*gain*32767),true);d.setInt16(46+i*4,Math.round(right[i]*gain*32767),true);}
 return {bytes,meta:{id,seconds:dur,sampleRate:rate,channels:2,source:"original synthesized realm wind, wildlife and water layers"}};
}
export function originalKingdomEntries(){const entries=[],heroes=[],cues=[];for(const [id,d] of Object.entries(HERO_DESIGNS)){const a=createOriginalHero(id,d);entries.push({name:'kingdom-original/heroes/'+id+'.glb',bytes:Buffer.from(a.bytes)});heroes.push(a.meta);}for(const [i,id] of CUE_IDS.entries()){const a=createOriginalCue(id,i);entries.push({name:'kingdom-original/audio/'+id+'.wav',bytes:Buffer.from(a.bytes)});cues.push(a.meta);}const soundscapes=[];for(const [id,profile] of Object.entries(REALM_AMBIENCE_PROFILES)){const a=createRealmAmbience(id,profile);entries.push({name:'kingdom-original/ambience/'+id+'.wav',bytes:Buffer.from(a.bytes)});soundscapes.push(a.meta);}return {entries,manifest:{schema:2,origin:'BUKLOD_ORIGINAL_PROCEDURAL',heroes,cues,soundscapes}};}
