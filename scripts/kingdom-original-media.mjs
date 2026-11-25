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
export function createOriginalHero(id, d) {
 const [primary,trim,hair,height,prop,variant]=d;
 const TAU=2*Math.PI, mats=[], meshes=[], nodes=[], anims=[], views=[], access=[], bin=[];
 const hex=x=>[parseInt(x.slice(1,3),16)/255,parseInt(x.slice(3,5),16)/255,parseInt(x.slice(5,7),16)/255,1].map((v,i)=>i<3?Math.pow(v,2.2):v);
 const material=(name,color,metallic=0,roughness=.65)=>{mats.push({name,pbrMetallicRoughness:{baseColorFactor:hex(color),metallicFactor:metallic,roughnessFactor:roughness},doubleSided:true});return mats.length-1};
 const cloth=material("Dyed fabric",primary,0,.85),metal=material("Engraved metal",trim,.66,.32),leather=material("Leather","#302b30",0,.8),skin=material("Skin","#c89577",0,.75),hairM=material("Hair",hair,0,.76),white=material("Eye ivory","#f1e7d9"),ink=material("Eye iris","#252a35"),accent=material("Gem",trim,.32,.23),dark=material("Undertunic","#17232c");
 const addBytes=(arr,type)=>{while(bin.length%4)bin.push(0);const start=bin.length, bytes=new Uint8Array(arr.length*(type===5123?2:4)),dv=new DataView(bytes.buffer);for(let i=0;i<arr.length;i++){if(type===5123)dv.setUint16(i*2,arr[i],true);else dv.setFloat32(i*4,arr[i],true)}for(const b of bytes)bin.push(b);views.push({buffer:0,byteOffset:start,byteLength:bytes.length});return views.length-1};
 const ac=(arr,type,shape,min,max)=>{const n={SCALAR:1,VEC3:3,VEC4:4}[shape];const item={bufferView:addBytes(arr,type),componentType:type,count:arr.length/n,type:shape};if(min)item.min=min;if(max)item.max=max;access.push(item);return access.length-1};
 const node=(name,t,parent)=>{const n={name,translation:t,children:[]};nodes.push(n);const i=nodes.length-1;if(parent>=0)nodes[parent].children.push(i);return i};
 const root=node(id,[0,0,0],-1), pelvis=node("Pelvis",[0,.90*height,0],root),torso=node("Spine",[0,.22*height,0],pelvis),head=node("Head",[0,.47*height,0],torso);
 const joints={};
 const geoms=new Map();
 function ell(j,m,c,s,segments=16,rings=10,tilt=0){
  const key=j+":"+m;let g=geoms.get(key);if(!g){g={p:[],n:[],i:[],j,m};geoms.set(key,g)}
  const off=g.p.length/3,cs=Math.cos(tilt),sn=Math.sin(tilt);
  for(let iy=0;iy<=rings;iy++){const th=Math.PI*iy/rings,sy=Math.cos(th),sr=Math.sin(th);for(let ix=0;ix<=segments;ix++){const a=TAU*ix/segments,x=sr*Math.cos(a),y=sy,z=sr*Math.sin(a);const px=x*s[0],py=y*s[1];g.p.push(c[0]+px*cs-py*sn,c[1]+px*sn+py*cs,c[2]+z*s[2]);let nx=x/s[0],ny=y/s[1],nz=z/s[2],l=Math.hypot(nx,ny,nz)||1;g.n.push((nx*cs-ny*sn)/l,(nx*sn+ny*cs)/l,nz/l);}}
  for(let iy=0;iy<rings;iy++)for(let ix=0;ix<segments;ix++){const a=off+iy*(segments+1)+ix,b=a+segments+1;g.i.push(a,a+1,b,a+1,b+1,b);}
 }
 // Fully modeled volumes: articulated body, sculpted face, fitted garments,
 // separate metal trims, boots, gloves and role-specific silhouette pieces.
 ell(pelvis,cloth,[0,0,0],[.26,.20,.17]);ell(torso,dark,[0,.03,0],[.27,.32,.17]);ell(torso,cloth,[0,.13,0],[.34,.29,.205]);
 ell(torso,metal,[0,.12,.185],[.17,.19,.034],12,8);ell(torso,accent,[0,.15,.221],[.055,.065,.024],10,7);
 ell(pelvis,leather,[0,.02,0],[.28,.057,.19]);ell(pelvis,metal,[0,.02,.184],[.095,.056,.035],12,6);
 // Asymmetric coat tails and embroidered collar; real geometry instead of flat art.
 for(let s of [-1,1]){ell(pelvis,cloth,[s*.17,-.15,-.018],[.135,.29+(variant%3)*.025,.13],14,9,s*.13);ell(torso,metal,[s*.23,.35,.05],[.11,.055,.105],12,7,s*.27);}
 ell(head,skin,[0,.12,0],[.175,.205,.166],24,14);
 ell(head,skin,[0,.093,.162],[.045,.052,.042],12,8);
 ell(head,skin,[0,.015,.144],[.079,.034,.027],12,7);
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
  joints["sh"+side]=sh;joints["el"+side]=el;joints["hip"+side]=hip;joints["knee"+side]=knee;
  ell(sh,cloth,[0,-.105,0],[.105,.19,.106]);ell(sh,metal,[s*.025,.025,.01],[.15+(variant%3)*.012,.095,.14],14,9,s*.2);
  ell(el,leather,[0,-.10,0],[.081,.158,.08]);ell(el,metal,[0,-.07,.062],[.072,.11,.042],12,8);
  ell(hand,skin,[0,-.035,0],[.061,.09,.055],12,8);
  ell(hip,dark,[0,-.17,0],[.115,.24,.12]);ell(knee,leather,[0,-.14,0],[.09,.20,.10]);ell(knee,metal,[0,.01,.077],[.09,.078,.047],12,7);
  ell(foot,leather,[0,-.015,.065],[.107,.078,.17],16,9);ell(foot,metal,[0,-.015,.179],[.096,.05,.065],12,7);
  if(s===1){
   const held=node("Signature_"+prop,[0,-.025,.07],hand);
   if(["staff","signal","hammer","harvest"].includes(prop)){ell(held,leather,[0,-.18,0],[.035,.39,.035],10,8);ell(held,metal,[0,.19,0],[.12,prop==="hammer"?.068:.15,.085],12,9);ell(held,accent,[0,.28,0],[.065,.07,.064],10,8);}
   else if(prop==="shield"){ell(held,metal,[.11,-.05,.02],[.21,.27,.055],20,12);ell(held,cloth,[.11,-.05,.07],[.16,.21,.027],16,10);ell(held,accent,[.11,-.05,.10],[.06,.07,.03],12,8);}
   else if(prop==="lute"){ell(held,leather,[.05,-.10,0],[.16,.21,.07],18,12);ell(held,metal,[.05,.14,0],[.037,.20,.04],10,8);ell(held,ink,[.05,-.1,.065],[.045,.05,.02],12,8);}
   else if(prop==="lantern"||prop==="blossom"){ell(held,metal,[0,.03,0],[.12,.13,.095],12,9);ell(held,accent,[0,.03,.06],[.075,.095,.05],12,9);for(let n=0;n<5;n++){let a=n*TAU/5;ell(held,accent,[.10*Math.cos(a),.10*Math.sin(a)+.04,.06],[.046,.046,.035],8,6);}}
   else {ell(held,leather,[.035,-.045,0],[.15,.17,.065],12,9);ell(held,metal,[.035,-.045,.056],[.13,.14,.025],12,8);ell(held,accent,[.035,-.045,.084],[.055,.065,.024],10,7);}
  }
 }
 // Each articulated node uses actual indexed triangle meshes with smooth normals.
 for(const g of geoms.values()){let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<g.p.length;i++) {let k=i%3;min[k]=Math.min(min[k],g.p[i]);max[k]=Math.max(max[k],g.p[i]);}
  let mesh={primitives:[{attributes:{POSITION:ac(g.p,5126,"VEC3",min,max),NORMAL:ac(g.n,5126,"VEC3")},indices:ac(g.i,5123,"SCALAR",[Math.min(...g.i)],[Math.max(...g.i)]),material:g.m}]};
  meshes.push(mesh);const idx=node("Surface_"+g.m,[0,0,0],g.j);nodes[idx].mesh=meshes.length-1;}
 const quat=(x,y,z)=>{const sx=Math.sin(x/2),cx=Math.cos(x/2),sy=Math.sin(y/2),cy=Math.cos(y/2),sz=Math.sin(z/2),cz=Math.cos(z/2);return [sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz]};
 for(const [name,dur] of [["Idle",2.4],["Walk",.92],["Run",.64],["Interact",1.1],["Celebrate",1.4]]){
  const times=Array.from({length:9},(_,i)=>dur*i/8),input=ac(times,5126,"SCALAR",[0],[dur]),samplers=[],channels=[];
  const track=(joint,fn)=>{const output=ac(times.flatMap((_,i)=>quat(...fn(i/8))),5126,"VEC4");samplers.push({input,output,interpolation:"LINEAR"});channels.push({sampler:samplers.length-1,target:{node:joint,path:"rotation"}})};
  const gait=name==="Walk"||name==="Run",amp=name==="Run"?.75:.43;
  for(const side of ["L","R"]){const sign=side==="L"?1:-1;track(joints["hip"+side],t=>[gait?amp*Math.sin(t*TAU)*sign:0,0,0]);track(joints["knee"+side],t=>[gait?Math.max(0,-Math.sin(t*TAU)*sign)*.62:0,0,0]);track(joints["sh"+side],t=>[gait?-amp*.7*Math.sin(t*TAU)*sign:name==="Interact"&&side==="R"?-.9*Math.sin(Math.PI*t):name==="Celebrate"?-.9*Math.sin(Math.PI*t):.035*Math.sin(t*TAU),0,sign*(.12+(name==="Celebrate"?.65*Math.sin(Math.PI*t):0))]);track(joints["el"+side],t=>[gait?-.18-.16*Math.max(0,Math.sin(t*TAU)*sign):name==="Interact"?-.65*Math.sin(Math.PI*t):-.12,0,0]);}
  track(torso,t=>[gait?.04:0,gait?.055*Math.sin(t*TAU):.03*Math.sin(t*TAU),0]);track(head,t=>[name==="Interact"?.12*Math.sin(Math.PI*t):.025*Math.sin(t*TAU),.05*Math.sin(t*TAU),0]);anims.push({name,samplers,channels});
 }
 for(const n of nodes)if(!n.children.length)delete n.children;
 const doc={asset:{version:"2.0",generator:"BUKLOD Original Living Kingdom Mesh Workshop v1"},scene:0,scenes:[{nodes:[root]}],nodes,meshes,materials:mats,animations:anims,buffers:[{byteLength:bin.length}],bufferViews:views,accessors:access};
 const json=JSON.stringify(doc),jb=Array.from(json,c=>c.charCodeAt(0));while(jb.length%4)jb.push(32);while(bin.length%4)bin.push(0);
 const bytes=new Uint8Array(12+8+jb.length+8+bin.length),dv=new DataView(bytes.buffer);dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,bytes.length,true);dv.setUint32(12,jb.length,true);dv.setUint32(16,0x4e4f534a,true);bytes.set(jb,20);const o=20+jb.length;dv.setUint32(o,bin.length,true);dv.setUint32(o+4,0x004e4942,true);bytes.set(bin,o+8);
 return {bytes,meta:{id,meshes:meshes.length,vertices:[...geoms.values()].reduce((s,g)=>s+g.p.length/3,0),triangles:[...geoms.values()].reduce((s,g)=>s+g.i.length/3,0),nodes:nodes.length,clips:anims.map(x=>x.name),prop}};
}
export function createOriginalCue(id,index){
 const rate=24000,dur=id==="complete"?2.4:id==="ambience"?8:id==="footstep"?.28:1.15,n=Math.floor(rate*dur),samples=new Float64Array(n);let seed=1234567+index*991,low=0,slow=0;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296*2-1};
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
export function originalKingdomEntries(){const entries=[],heroes=[],cues=[];for(const [id,d] of Object.entries(HERO_DESIGNS)){const a=createOriginalHero(id,d);entries.push({name:'kingdom-original/heroes/'+id+'.glb',bytes:Buffer.from(a.bytes)});heroes.push(a.meta);}for(const [i,id] of CUE_IDS.entries()){const a=createOriginalCue(id,i);entries.push({name:'kingdom-original/audio/'+id+'.wav',bytes:Buffer.from(a.bytes)});cues.push(a.meta);}return {entries,manifest:{schema:1,origin:'BUKLOD_ORIGINAL_PROCEDURAL',heroes,cues}};}
