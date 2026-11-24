// Original procedural wildlife and resource review candidates. Node 18+, zero dependencies.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function generateWildlife(){
 const creatures=[
 ["azure_stag","stag",[.13,.43,.72],1.0],["crimson_wolf","wolf",[.55,.08,.11],.85],["emerald_serpent","serpent",[.10,.48,.25],.95],["golden_scarab","scarab",[.77,.48,.09],.8],["stone_golem","golem",[.36,.40,.43],1.25],["river_spirit","spirit",[.13,.55,.66],1.1],["wind_falcon","falcon",[.47,.63,.77],.8],["ancient_sentinel","sentinel",[.40,.47,.48],1.65],["colossal_guardian","guardian",[.34,.20,.46],2.15]];
 const resources=[["wood","forest"],["stone","quarry"],["crystal","crystal"],["gold","gold"],["food","farm"]];
 function make(id,type,color,scale,rigged){
  const mats=[["body",color,.15,.71],["dark",color.map(x=>x*.38),.12,.84],["armor",color.map(x=>Math.min(1,x*1.35+.12)),.56,.39],["glow",color.map(x=>Math.min(1,x*1.7+.2)),.25,.26],["earth",[.20,.14,.09],0,.94],["leaf",[.14,.38,.12],0,.91]];
  const materials=mats.map(([name,c,m,r],i)=>({name,pbrMetallicRoughness:{baseColorFactor:[...c,1],metallicFactor:m,roughnessFactor:r},...(i===3?{emissiveFactor:c.map(x=>x*.28)}:{})}));
  let nodes=[],rests=[],geo=Array.from({length:6},()=>({p:[],n:[],j:[],w:[],uv:[]}));
  const bone=(name,parent,world)=>{let i=nodes.length;nodes.push({name,translation:world.map((x,k)=>(x-(parent<0?0:rests[parent][k]))*scale)});rests.push(world);if(parent>=0)(nodes[parent].children??=[]).push(i);return i};
  const root=bone("Root",-1,[0,0,0]),body=bone("Body",root,[0,.95,0]),head=bone("Head",body,[0,1.25,.65]);
  const limbs=[bone("LeftFront",body,[-.38,.72,.55]),bone("RightFront",body,[.38,.72,.55]),bone("LeftRear",body,[-.38,.72,-.55]),bone("RightRear",body,[.38,.72,-.55])],tail=bone("Tail",body,[0,.90,-.65]);
  const unit=v=>{let n=Math.hypot(...v);if(n<1e-10)throw Error("Invalid normal");return v.map(x=>x/n)};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const sub=(a,b)=>a.map((x,k)=>x-b[k]);
  function tri(m,j,a,b,c,na,nb,nc){
   let face=cross(sub(b,a),sub(c,a));if(Math.hypot(...face)<1e-9)return;
   if(face.reduce((s,x,k)=>s+x*na[k],0)<0){[b,c]=[c,b];[nb,nc]=[nc,nb]}
   const g=geo[m];for(const [p,n] of [[a,na],[b,nb],[c,nc]]){if(p.some(x=>!Number.isFinite(x)))throw Error("Invalid vertex");g.p.push(...p.map(x=>x*scale));g.n.push(...unit(n));g.j.push(j,0,0,0);g.w.push(1,0,0,0);g.uv.push(p[0]*.75,p[2]*.75)}
  }
  function ell(m,j,c,r,N=18,M=10){
   const at=(u,v)=>{let a=u*2*Math.PI,b=(v-.5)*Math.PI,n=[Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)];return [c.map((x,k)=>x+n[k]*r[k]),unit(n.map((x,k)=>x/r[k]))]};
   for(let y=0;y<M;y++)for(let x=0;x<N;x++){let [a,b,c,d]=[at(x/N,y/M),at(x/N,(y+1)/M),at((x+1)/N,(y+1)/M),at((x+1)/N,y/M)];tri(m,j,a[0],b[0],c[0],a[1],b[1],c[1]);tri(m,j,a[0],c[0],d[0],a[1],c[1],d[1])}
  }
  function rod(m,j,a,b,r1,r2,N=10){
   const dir=unit(sub(b,a)),u=unit(cross(dir,Math.abs(dir[1])>.9?[1,0,0]:[0,1,0])),v=cross(dir,u);
   const at=(p,r,i)=>{let t=i*2*Math.PI/N,n=u.map((x,k)=>x*Math.cos(t)+v[k]*Math.sin(t));return [p.map((x,k)=>x+n[k]*r),n]};
   for(let i=0;i<N;i++){const [p,q,r,s]=[at(a,r1,i),at(b,r2,i),at(b,r2,i+1),at(a,r1,i+1)];tri(m,j,p[0],q[0],r[0],p[1],q[1],r[1]);tri(m,j,p[0],r[0],s[0],p[1],r[1],s[1]);tri(m,j,a,s[0],p[0],dir.map(x=>-x),dir.map(x=>-x),dir.map(x=>-x));tri(m,j,b,q[0],r[0],dir,dir,dir)}
  }
  const eyes=(x,y,z)=>{for(const s of [-1,1])ell(3,head,[s*x,y,z],[.055,.055,.048],10,6)};
  if(type==="stag"||type==="wolf"){
   const stag=type==="stag";ell(0,body,[0,.95,0],[.38,stag?.47:.38,.77]);ell(0,head,[0,1.31,.67],[.25,.31,.31]);ell(1,head,[0,1.20,.94],[.19,.16,.28]);eyes(.15,1.38,.86);
   for(let i=0;i<4;i++){let [x,y,z]=rests[limbs[i]];rod(0,limbs[i],[x,y,z],[x*.94,.22,z+.05],.115,.07);ell(1,limbs[i],[x*.94,.13,z+.08],[.10,.12,.15]);}
   rod(1,tail,[0,.98,-.64],[0,stag?1.22:.70,-1.12],.11,.025);
   for(const s of [-1,1]){ell(0,head,[s*.25,1.57,.63],[.10,.19,.08]);if(stag){let a=[s*.15,1.56,.59],b=[s*.38,2.05,.55],c=[s*.42,2.35,.45];rod(2,head,a,b,.07,.044);rod(2,head,b,c,.044,.015);rod(2,head,b,[s*.62,2.15,.72],.035,.012);rod(2,head,[s*.25,1.83,.57],[s*.43,1.98,.84],.035,.01)}}
   if(!stag)for(let i=0;i<9;i++)rod(2,body,[0,1.20,-.60+i*.15],[0,1.49,-.72+i*.15],.09,.012);
  }else if(type==="serpent"){
   for(let i=0;i<19;i++){let a=i*.33;ell(i%3===0?2:0,i<10?body:tail,[Math.sin(a)*.67,.24+i*.018,Math.cos(a)*.67],[.23-i*.005,.19,.23-i*.005],14,8)}
   rod(0,head,[0,.48,.40],[0,1.48,.64],.24,.15);ell(0,head,[0,1.49,.70],[.25,.19,.32]);eyes(.17,1.54,.90);for(let s of [-1,1])rod(2,head,[s*.19,1.45,.68],[s*.39,1.65,.47],.10,.01);
  }else if(type==="scarab"){
   ell(1,body,[0,.48,0],[.60,.42,.83]);for(const s of [-1,1])ell(2,body,[s*.24,.70,-.08],[.35,.36,.69]);ell(0,head,[0,.52,.67],[.29,.24,.31]);eyes(.19,.59,.87);
   for(let i=0;i<6;i++){let s=i<3?-1:1,z=(i%3-1)*.45,j=limbs[i%4];rod(2,j,[s*.36,.49,z],[s*.79,.22,z+.08],.09,.06);rod(1,j,[s*.79,.22,z+.08],[s*.91,.05,z+.22],.06,.02)}
   for(const s of [-1,1])rod(2,head,[s*.13,.48,.85],[s*.26,.52,1.20],.08,.015);
  }else if(type==="falcon"){
   ell(0,body,[0,1.05,0],[.33,.38,.56]);ell(0,head,[0,1.43,.38],[.22,.23,.22]);rod(2,head,[0,1.40,.55],[0,1.34,.83],.13,.018);eyes(.16,1.48,.52);
   for(const [i,s] of [[0,-1],[1,1]])for(let k=0;k<9;k++){let z=.24-k*.095;ell(k%2?0:2,limbs[i],[s*(.49+k*.10),1.02,z],[.38,.052,.13],14,6);}
   for(let k=0;k<5;k++)ell(1,tail,[(k-2)*.12,.89,-.69],[.10,.05,.39],14,6);
   for(const s of [-1,1])rod(2,body,[s*.13,.82,.04],[s*.18,.49,.09],.065,.045);
  }else if(type==="spirit"){
   for(let i=0;i<12;i++){let a=i*.57;ell(i%3===0?3:0,body,[Math.cos(a)*.29,.35+i*.10,Math.sin(a)*.29],[.28,.25,.28],14,8)}
   ell(0,head,[0,1.64,.06],[.32,.32,.27]);eyes(.13,1.68,.28);
   for(const [i,s] of [[0,-1],[1,1]])for(let k=0;k<5;k++)ell(k%2?0:3,limbs[i],[s*(.3+k*.13),1.05-k*.09,.10],[.19,.13,.15],12,8);
  }else if(["golem","sentinel","guardian"].includes(type)){
   ell(1,body,[0,.98,0],[.48,.56,.36]);ell(2,body,[0,1.17,.05],[.55,.44,.37]);ell(2,head,[0,1.73,.13],[.30,.30,.29]);eyes(.15,1.78,.37);
   for(const [i,s] of [[0,-1],[1,1]]){ell(2,limbs[i],[s*.61,1.22,0],[.30,.32,.30]);rod(1,limbs[i],[s*.61,1.2,0],[s*.77,.60,.12],.21,.18);ell(2,limbs[i],[s*.77,.50,.13],[.23,.24,.24]);ell(2,limbs[i+2],[s*.25,.43,0],[.24,.42,.24]);ell(1,limbs[i+2],[s*.25,.14,.16],[.25,.14,.31]);}
   ell(3,body,[0,1.24,.39],[.19,.21,.10],12,8);
   if(type!=="golem")for(const s of [-1,1]){rod(2,head,[s*.22,1.82,.10],[s*.42,2.18,-.02],.13,.024);for(let k=0;k<4;k++)rod(2,body,[s*.35,1.04+k*.18,-.22],[s*.70,1.22+k*.18,-.34],.10,.02)}
   if(type==="guardian")for(let k=0;k<7;k++)rod(3,body,[(k-3)*.13,1.35,-.30],[(k-3)*.18,1.95+(.3-Math.abs(k-3)*.06),-.46],.09,.014);
  }else {
   // Resource props are static and never imply stock or a gameplay collider.
   ell(4,root,[0,.05,0],[1.6,.12,1.3],24,8);
   if(type==="forest"){for(let i=0;i<5;i++){let a=i*2.4,x=Math.cos(a)*.9,z=Math.sin(a)*.8;rod(1,root,[x,0,z],[x,2.1,z],.15,.08);for(let k=0;k<3;k++)ell(5,root,[x,1.3+k*.43,z],[.60-k*.12,.62,.60-k*.12],16,8)}}
   else if(type==="farm"){for(let i=0;i<5;i++)for(let j=0;j<6;j++){let x=(i-2)*.48,z=(j-2.5)*.38;rod(5,root,[x,.10,z],[x,.55,z],.045,.012,8);ell(2,root,[x,.43,z],[.075,.19,.075],10,6);}}
   else{for(let i=0;i<9;i++){let a=i*2.4,x=Math.cos(a)*(.2+i*.10),z=Math.sin(a)*(.2+i*.09),h=.35+(i%3)*.24;ell(1,root,[x,.12,z],[.39,.23,.36],10,6);rod(type==="quarry"?2:3,root,[x,.20,z],[x+.10,h+.25,z-.07],.21,.015,6)}}
  }
  const chunks=[],views=[],accessors=[];let offset=0;
  function acc(values,width,type="VEC"+width,short=false,bounds=false){let pad=(4-offset%4)%4;if(pad){chunks.push(new Uint8Array(pad));offset+=pad}const bytes=new Uint8Array(values.length*(short?2:4)),d=new DataView(bytes.buffer);for(let i=0;i<values.length;i++)short?d.setUint16(i*2,values[i],true):d.setFloat32(i*4,values[i],true);views.push({buffer:0,byteOffset:offset,byteLength:bytes.length});offset+=bytes.length;chunks.push(bytes);let a={bufferView:views.length-1,componentType:short?5123:5126,count:values.length/width,type};if(bounds){a.min=Array(width).fill(Infinity);a.max=Array(width).fill(-Infinity);for(let i=0;i<values.length;i++){let v=d.getFloat32(i*4,true);a.min[i%width]=Math.min(a.min[i%width],v);a.max[i%width]=Math.max(a.max[i%width],v)}}accessors.push(a);return accessors.length-1}
  let primitives=[],triangles=0;geo.forEach((g,i)=>{if(!g.p.length)return;triangles+=g.p.length/9;let attributes={POSITION:acc(g.p,3,"VEC3",false,true),NORMAL:acc(g.n,3),TEXCOORD_0:acc(g.uv,2)};if(rigged){attributes.JOINTS_0=acc(g.j,4,"VEC4",true);attributes.WEIGHTS_0=acc(g.w,4)}primitives.push({material:i,mode:4,attributes})});
  let doc={asset:{version:"2.0",generator:"BUKLOD original wildlife candidate"},scene:0,scenes:[{nodes:[]}],nodes:rigged?nodes:[],meshes:[{name:id,primitives}],materials,bufferViews:views,accessors,buffers:[{byteLength:0}],extras:{id,reviewOnly:true,source:"original procedural candidate",gameplayCollider:false}};
  if(rigged){let matrices=rests.flatMap(([x,y,z])=>[1,0,0,0,0,1,0,0,0,0,1,0,-x*scale,-y*scale,-z*scale,1]);doc.skins=[{joints:rests.map((_,i)=>i),skeleton:root,inverseBindMatrices:acc(matrices,16,"MAT4")}];doc.nodes.push({name:id,mesh:0,skin:0});doc.scenes[0].nodes=[0,doc.nodes.length-1];doc.animations=[];
   for(const [name,duration] of [["Idle",2],["Walk",.8],["Attack",.9],["Hit",.35],["Death",1.2],["Roar",1.5]]){let times=acc(Array.from({length:13},(_,i)=>duration*i/12),1,"SCALAR",false,true),samplers=[],channels=[];for(let j=0;j<rests.length;j++){let values=[];for(let k=0;k<13;k++){let t=k/12,w=Math.sin(t*2*Math.PI),p=Math.sin(t*Math.PI),angle=0,axis=0;if(name==="Idle")angle=j===body?.045*w:j===tail?.14*w:0;if(name==="Walk")angle=limbs.includes(j)?(j%2?1:-1)*.5*w:j===tail?.25*w:0;if(type==="falcon"&&limbs.includes(j)&&(name==="Walk"||name==="Attack")){axis=2;angle=(j%2?1:-1)*.65*w}if(name==="Attack"&&(j===head||j===body))angle=-.48*p;if(name==="Hit"&&j===body)angle=.23*p;if(name==="Death"&&j===root){axis=2;angle=1.42*t}if(name==="Roar"&&j===head)angle=-.35*p;let q=[0,0,0,Math.cos(angle/2)];q[axis]=Math.sin(angle/2);values.push(...q)}let output=acc(values,4);samplers.push({input:times,output,interpolation:"LINEAR"});channels.push({sampler:samplers.length-1,target:{node:j,path:"rotation"}})}doc.animations.push({name,samplers,channels})}
  }else{doc.nodes=[{name:id,mesh:0}];doc.scenes[0].nodes=[0]}
  doc.buffers[0].byteLength=offset;const js=JSON.stringify(doc),len=js.length+(4-js.length%4)%4,out=new Uint8Array(28+len+offset),d=new DataView(out.buffer);[0x46546c67,2,out.length,len,0x4e4f534a].forEach((x,i)=>d.setUint32(i*4,x,true));for(let i=0;i<len;i++)out[20+i]=i<js.length?js.charCodeAt(i):32;d.setUint32(20+len,offset,true);d.setUint32(24+len,0x004e4942,true);let at=28+len;for(const c of chunks){out.set(c,at);at+=c.length}return {id,kind:rigged?"creature":"resource",bytes:out,triangles,bones:rigged?rests.length:0,clips:rigged?6:0}
 }
 return [...creatures.map(([id,t,c,s])=>make(id,t,c,s,true)),...resources.map(([id,t])=>make(id,t,id==="gold"?[.72,.50,.14]:id==="crystal"?[.26,.58,.78]:[.37,.38,.32],1,false))];
}
const out=new URL('./ReviewOutput/wildlife/',import.meta.url);mkdirSync(out,{recursive:true});
const rows=generateWildlife().map(({bytes,...r})=>{const file=r.id+'.glb';writeFileSync(new URL(file,out),bytes);return {...r,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});
writeFileSync(new URL('manifest.json',out),JSON.stringify({status:'REVIEW_ONLY',models:rows},null,2)+'\n');console.log('Generated',rows.length,'original wildlife/resource review GLBs');
