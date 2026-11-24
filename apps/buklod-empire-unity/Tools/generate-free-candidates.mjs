// Original BUKLOD procedural candidates. Node.js 18+, no dependencies or network.
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
function generateCandidates(){
 const PI=Math.PI, TAU=2*PI, palette=[
 ["terrain",[.15,.28,.22],0,.95],["stone",[.25,.34,.39],.08,.83],["paving",[.34,.40,.43],.12,.78],["water",[.045,.28,.4],.35,.22],["foliage",[.09,.35,.20],0,.88],["wood",[.23,.14,.08],0,.85],["lux_steel",[.65,.73,.80],.55,.35],["lux_blue",[.065,.25,.70],.4,.32],["gold",[.76,.49,.12],.72,.27],["tenebra_steel",[.115,.12,.16],.62,.38],["tenebra_red",[.53,.035,.055],.34,.35],["crystal_blue",[.1,.67,.95],.27,.2,[.03,.25,.5]],["crystal_red",[.95,.07,.13],.28,.22,[.5,.025,.04]],["skin",[.59,.37,.23],0,.77],["cloth",[.18,.19,.24],0,.85],["crystal_rift",[.47,.24,.78],.2,.25,[.13,.05,.3]],["grass_edge",[.21,.35,.22],0,.9]
 ];
 const mats=palette.map(([name,c,m,r,e])=>({name,pbrMetallicRoughness:{baseColorFactor:[...c,1],metallicFactor:m,roughnessFactor:r},...(e?{emissiveFactor:e}:{})}));
 const vadd=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]), cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 class Mesh {
  constructor(name){this.name=name;this.groups=new Map();}
  tri(m,a,b,c){const n=cross(sub(b,a),sub(c,a)),l=Math.hypot(...n);if(l<1e-8)return;let g=this.groups.get(m);if(!g){g={p:[],n:[]};this.groups.set(m,g)};for(const v of [a,b,c]){g.p.push(...v);g.n.push(...n.map(x=>x/l));}}
  quad(m,a,b,c,d){this.tri(m,a,b,c);this.tri(m,a,c,d);}
  box(m,c,s){const [x,y,z]=s.map(v=>v/2),p=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]].map(v=>vadd(c,v));for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]])this.quad(m,...f.map(i=>p[i]));}
  loft(m,c,rings,n=10){const rows=rings.map(([y,x,z])=>Array.from({length:n},(_,i)=>vadd(c,[x*Math.cos(i*TAU/n),y,z*Math.sin(i*TAU/n)])));for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){const k=(i+1)%n;this.quad(m,rows[j][i],rows[j+1][i],rows[j+1][k],rows[j][k]);}for(let i=0;i<n;i++){const k=(i+1)%n;this.tri(m,vadd(c,[0,rings[0][0],0]),rows[0][i],rows[0][k]);this.tri(m,vadd(c,[0,rings[rings.length-1][0],0]),rows[rows.length-1][k],rows[rows.length-1][i]);}}
  cyl(m,c,r,h,n=10){this.loft(m,c,[[-h/2,r,r],[h/2,r,r]],n);}
  gem(m,c,r,h,n=6){this.loft(m,c,[[-h/2,.001,.001],[-h*.16,r,r],[h*.20,r*.65,r*.65],[h/2,.001,.001]],n);}
  orb(m,c,r){this.loft(m,c,[[-r,.001,.001],[-r*.7,r*.7,r*.7],[0,r,r],[r*.7,r*.7,r*.7],[r,.001,.001]],10);}
 }
 function glb(name,objects){
  const doc={asset:{version:"2.0",generator:"BUKLOD original procedural candidate pipeline"},scene:0,scenes:[{name,nodes:[]}],nodes:[],meshes:[],materials:mats,accessors:[],bufferViews:[],buffers:[{byteLength:0}],extras:{candidate:true,visualReview:false,source:"original procedural geometry; no third-party meshes"}};
  const chunks=[];let offset=0;const stats=[];
  function accessor(arr,isPos){if(arr.length%3||arr.some(v=>!Number.isFinite(v)))throw Error("invalid vertex data");const a=new Float32Array(arr);const bytes=new Uint8Array(a.buffer);const view=doc.bufferViews.length;doc.bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target:34962});chunks.push(bytes);offset+=bytes.length;const idx=doc.accessors.length;const acc={bufferView:view,componentType:5126,count:arr.length/3,type:"VEC3"};if(isPos){acc.min=[Infinity,Infinity,Infinity];acc.max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<arr.length;i++) {const j=i%3;acc.min[j]=Math.min(acc.min[j],arr[i]);acc.max[j]=Math.max(acc.max[j],arr[i]);}}doc.accessors.push(acc);return idx;}
  for(const {mesh,at=[0,0,0]} of objects){const primitives=[];let count=0;for(const [material,g] of mesh.groups){if(!g.p.length)continue;const pos=accessor(g.p,true),normal=accessor(g.n,false);primitives.push({attributes:{POSITION:pos,NORMAL:normal},material,mode:4});count+=g.p.length/9;}if(!count)throw Error("empty geometry");const ix=doc.meshes.length;doc.meshes.push({name:mesh.name,primitives});doc.scenes[0].nodes.push(doc.nodes.length);doc.nodes.push({name:mesh.name,mesh:ix,translation:at});stats.push({id:mesh.name,triangles:count,primitives:primitives.length});}
  doc.buffers[0].byteLength=offset;
  const str=JSON.stringify(doc),pad=(4-str.length%4)%4,jlen=str.length+pad,binlen=offset;
  const out=new Uint8Array(12+8+jlen+8+binlen),dv=new DataView(out.buffer);dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,out.length,true);dv.setUint32(12,jlen,true);dv.setUint32(16,0x4e4f534a,true);for(let i=0;i<jlen;i++)out[20+i]=i<str.length?str.charCodeAt(i):32;dv.setUint32(20+jlen,binlen,true);dv.setUint32(24+jlen,0x004e4942,true);let cur=28+jlen;for(const b of chunks){out.set(b,cur);cur+=b.length;}
  if(cur!==out.length||dv.getUint32(8,true)!==out.length)throw Error("bad GLB length");
  return {name:name+".glb",bytes:out,stats};
 }
 const results=[];
 const terrain=new Mesh("GenesisRift_terrain"),paths=new Mesh("GenesisRift_lanes"),props=new Mesh("GenesisRift_cover_and_vegetation");
 terrain.box(0,[160,-.6,110],[320,1.2,220]);
 const ys=[41.8,110,178.2];
 for(const y of ys){paths.box(2,[160,.04,y],[318,.08,9]);for(const s of [-1,1])paths.box(1,[160,.03,y+s*5],[318,.06,1]);for(let x=12;x<320;x+=12){paths.box(1,[x,.085,y],[.12,.025,8.7]);}}
 paths.box(3,[160,.095,110],[11,.05,218]);
 for(const y of ys){paths.box(2,[160,.18,y],[17,.13,10]);for(const z of [-5.2,5.2])paths.box(8,[160,.35,y+z],[17,.25,.25]);}
 for(const x of [14,306]){paths.cyl(1,[x,.05,110],12,.1,24);paths.cyl(2,[x,.115,110],9,.03,24);}
 const cover=[[.29,.23,.025],[.71,.77,.025],[.42,.41,.025],[.58,.59,.025],[.48,.81,.018],[.52,.19,.018]];
 for(const [nx,nz,nr] of cover){const x=nx*320,z=nz*220,r=nr*220;props.loft(1,[x,0,z],[[0,r,r],[1.2,r*.8,r*.75],[2.6,r*.4,r*.45],[3.2,.05,.05]],8);for(let i=0;i<4;i++){const t=i*TAU/4+.3;props.gem(15,[x+Math.cos(t)*r*.5,2.1,z+Math.sin(t)*r*.5],r*.17,3+i*.23,5);}}
 for(let side=0;side<2;side++)for(let i=0;i<25;i++){const x=23+i*11.1,z=side===0?9:211;const h=3.5+(i%3)*.7;props.cyl(5,[x,h*.4,z],.25,h*.8,7);props.loft(4,[x,h*.55,z],[[0,1.4,1.4],[h*.7,.04,.04]],7);}
 // Route borders and art landmarks stay outside the canonical walk lanes.
 for(const x of [56,264])for(const z of [75,145]){props.cyl(1,[x,.3,z],2,.6,12);props.gem(15,[x,2.4,z],.75,3.5);}
 results.push(glb("genesis_rift_candidate",[{mesh:terrain},{mesh:paths},{mesh:props}]));
 const roles=["infantry","mage","gunner","siege","healer"];
 const villagers=[["aron","lira","daren","serah","kiel","miko"],["rogar","velin","kael","mora","zed","taro"]];
 for(let team=0;team<2;team++){
  const t=team?"tenebra":"lux",metal=team?9:6,cloth=team?10:7,glow=team?12:11,trim=team?10:8;
  const tower=new Mesh(t+"_tower"),core=new Mesh(t+"_core");
  tower.cyl(1,[0,.35,0],2.6,.7,12);tower.loft(metal,[0,0,0],[[.7,1.8,1.8],[1.4,1.4,1.4],[4.7,1.05,1.05],[5.5,1.5,1.5],[6,1.5,1.5]],8);for(const y of [1.35,4.8,5.8])tower.cyl(trim,[0,y,0],y===1.35?1.6:1.62,.22,12);tower.gem(glow,[0,7.2,0],.9,2.7,6);for(let i=0;i<6;i++){const a=i*TAU/6;tower.gem(glow,[1.7*Math.cos(a),5.2,1.7*Math.sin(a)],.22,1.4,5);}
  core.cyl(1,[0,.45,0],3.5,.9,16);core.cyl(metal,[0,1.1,0],2.8,.4,16);core.cyl(trim,[0,1.45,0],2.5,.2,16);core.gem(glow,[0,3.6,0],1.6,4.4,8);for(let i=0;i<6;i++){const a=i*TAU/6,x=Math.cos(a)*2.8,z=Math.sin(a)*2.8;core.loft(metal,[x,0,z],[[.8,.55,.55],[2.8,.35,.35],[3.5,.06,.06]],5);core.gem(glow,[x,3.5,z],.22,1.1,5);}
  results.push(glb(t+"_tower_candidate",[{mesh:tower}]),glb(t+"_core_candidate",[{mesh:core}]));
  const actors=[];
  for(let i=0;i<roles.length;i++){
   const role=roles[i],m=new Mesh(t+"_"+role);
   if(role==="siege"){
    m.loft(metal,[0,0,0],[[.2,.95,.65],[.65,1,.7],[1.15,.72,.6]],8);for(const s of [-1,1])for(const z of [-.48,.48]){m.box(cloth,[s*.86,.35,z],[.32,.65,.48]);m.gem(trim,[s*.88,.65,z],.18,.35,5);}m.box(metal,[0,1.25,.5],[.55,.5,1.35]);m.gem(glow,[0,1.28,1.23],.24,.45);m.gem(glow,[0,1.5,-.12],.4,.75);
   }else{
    const w=role==="infantry"?.50:.36;
    for(const s of [-1,1]){m.loft(metal,[s*w*.55,0,0],[[.04,.19,.22],[.42,.16,.16],[.77,.18,.16]],7);m.box(trim,[s*w*.55,.1,.08],[.39,.16,.49]);m.loft(metal,[s*(w+.1),.9,0],[[0,.12,.12],[.45,.16,.15],[.58,.19,.18]],7);}
    m.loft(cloth,[0,0,0],[[.62,w*.7,.25],[.9,w,.28],[1.37,w,.3],[1.56,w*.55,.23]],8);m.loft(metal,[0,0,0],[[1.02,w+.08,.3],[1.47,w+.1,.32],[1.57,w*.65,.26]],8);m.loft(metal,[0,0,0],[[1.55,.22,.23],[1.75,.32,.29],[2.05,.27,.23],[2.15,.08,.08]],8);m.box(glow,[0,1.82,.273],[.34,.09,.035]);m.gem(trim,[0,1.26,.33],.13,.31);
    if(role==="infantry"){m.loft(trim,[-.62,1.15,.22],[[-.46,.16,.11],[-.2,.35,.12],[.33,.35,.12],[.46,.15,.11]],6);m.box(metal,[.63,1.21,.17],[.13,1.28,.15]);m.gem(glow,[.63,1.98,.17],.16,.47);}
    if(role==="mage"||role==="healer"){m.cyl(trim,[.63,1.35,.16],.065,2.35,7);m.gem(glow,[.63,2.6,.16],.22,.6);if(role==="healer"){m.box(glow,[0,1.32,.39],[.08,.32,.04]);m.box(glow,[0,1.32,.39],[.32,.08,.04]);}else m.gem(glow,[0,2.25,0],.25,.56);}
    if(role==="gunner"){m.box(metal,[.45,1.23,.52],[.32,.3,.95]);m.box(trim,[.45,1.23,.99],[.23,.21,.23]);m.gem(glow,[.45,1.42,.49],.14,.33);}
   }
   actors.push({mesh:m,at:[i*3.4,0,0]});
  }
  for(let i=0;i<6;i++){
   const id=villagers[team][i],m=new Mesh(t+"_"+id);const w=.3+(i%3)*.04;
   for(const s of [-1,1]){m.loft(14,[s*.15,0,0],[[.05,.13,.15],[.75,.13,.12]],7);m.box(5,[s*.15,.09,.08],[.3,.18,.4]);m.loft(13,[s*(w+.07),.9,0],[[0,.10,.10],[.42,.1,.10]],7);}
   m.loft(cloth,[0,0,0],[[.65,.29,.19],[.94,w,.23],[1.36,w,.23],[1.49,.22,.18]],9);m.box(trim,[0,.91,.24],[w*1.65,.10,.09]);m.orb(13,[0,1.65,0],.24);
   if(i===1||i===4)m.loft(14,[0,1.72,0],[[0,.29,.28],[.24,.23,.24],[.37,.02,.03]],8);else m.loft(metal,[0,1.77,0],[[0,.28,.26],[.21,.24,.23],[.25,.07,.07]],8);
   m.gem(trim,[0,1.2,.255],.085,.21);
   if(i===0){m.box(5,[.46,1.3,.17],[.085,.85,.085]);m.box(metal,[.46,1.72,.17],[.4,.18,.25]);}
   if(i===1){m.box(5,[-.46,1.08,.22],[.28,.38,.29]);m.box(4,[-.46,1.29,.22],[.23,.10,.23]);}
   if(i===2){m.box(trim,[.43,1.25,.17],[.12,.9,.14]);m.gem(glow,[.43,1.84,.17],.12,.34);}
   if(i===3){m.cyl(5,[.47,1.12,.18],.055,1.6,7);m.gem(glow,[.47,2.01,.18],.17,.45);}
   if(i===4){m.box(metal,[.43,1.17,.31],[.31,.4,.15]);m.gem(glow,[.43,1.38,.38],.12,.25);}
   if(i===5){m.box(5,[0,1.15,-.31],[.53,.65,.29]);m.gem(glow,[.46,1.10,.21],.14,.28);}
   actors.push({mesh:m,at:[i*3.4,0,4]});
  }
  results.push(glb(t+"_faction_candidates",actors));
 }
 return results;
}
const out=fileURLToPath(new URL('./AssetCandidates/',import.meta.url));mkdirSync(out,{recursive:true});for(const asset of generateCandidates()){writeFileSync(join(out,asset.name),asset.bytes);console.log(asset.name,asset.bytes.length,asset.stats.length);}
