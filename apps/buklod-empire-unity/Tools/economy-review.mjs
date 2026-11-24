// Original faction buildings and field pickups, no packages or network. Node 18+.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function economyModels(){
 const list=[];for(const team of ["lux","tenebra"])for(const role of ["depot","guard_post","farm","barracks","market","house"])list.push([team+"_"+role,team,role]);list.push(["field_pickup","neutral","pickup"],["relic_pickup","neutral","relic"]);
 return list.map(([id,team,role])=>{
 const lux=team==="lux",neutral=team==="neutral";
 const colors=[lux?[.36,.47,.59]:[.25,.24,.31],lux?[.67,.43,.13]:[.52,.12,.16],lux?[.10,.34,.68]:[.31,.07,.15],[.29,.18,.10],[.21,.40,.13],[.65,.76,.91]];
 const materials=colors.map((c,i)=>({name:["masonry","trim","roof","timber","crop","crystal"][i],pbrMetallicRoughness:{baseColorFactor:[...c,1],metallicFactor:i===1?.65:i===5?.35:.03,roughnessFactor:i===5?.24:i===1?.35:.8},...(i===5?{emissiveFactor:[.12,.21,.32]}:{})}));
 const gs=colors.map(()=>({p:[],n:[],uv:[]}));let triangles=0;
 function tri(m,a,b,c){const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l<1e-9)return;const q=gs[m],nn=n.map(x=>x/l),axis=nn.map(Math.abs).indexOf(Math.max(...nn.map(Math.abs))),axes=[0,1,2].filter(i=>i!==axis);for(const p of [a,b,c]){if(p.some(x=>!Number.isFinite(x))||Math.abs(p[0])>4||Math.abs(p[2])>4||p[1]<0||p[1]>7)throw Error("bounds "+id);q.p.push(...p);q.n.push(...nn);q.uv.push(p[axes[0]],p[axes[1]])}triangles++;}
 function quad(m,a,b,c,d){tri(m,a,b,c);tri(m,a,c,d)}
 function box(m,x,y,z,w,h,d){const p=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+(b+1)*h/2,z+c*d/2]);for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]])quad(m,...f.map(i=>p[i]))}
 function loft(m,x,y,z,rings,N=12,phase=0){const p=rings.map(([h,rx,rz])=>Array.from({length:N},(_,i)=>{const a=phase+i*2*Math.PI/N;return [x+Math.cos(a)*rx,y+h,z+Math.sin(a)*rz]}));for(let j=0;j<p.length-1;j++)for(let i=0;i<N;i++){let k=(i+1)%N;quad(m,p[j][i],p[j+1][i],p[j+1][k],p[j][k])}for(let i=0;i<N;i++){let k=(i+1)%N,j=p.length-1;tri(m,[x,y+rings[0][0],z],p[0][i],p[0][k]);tri(m,[x,y+rings[j][0],z],p[j][k],p[j][i])}}
 function roof(x,y,z,w,d,h){const a=[x-w/2,y,z-d/2],b=[x+w/2,y,z-d/2],c=[x+w/2,y,z+d/2],e=[x-w/2,y,z+d/2],f=[x,y+h,z-d/2],g=[x,y+h,z+d/2];quad(2,a,e,g,f);quad(2,b,f,g,c);tri(2,a,f,b);tri(2,e,c,g);for(const zz of [-d/2,d/2])box(1,x,y-.06,z+zz,w,.12,.14);box(1,x,y+h-.04,z,.14,.12,d+.15)}
 function column(x,z,h){loft(0,x,.15,z,[[0,.22,.22],[.14,.27,.27],[h-.2,.17,.17],[h,.23,.23]],lux?10:6);for(const y of [.25,h-.1])loft(1,x,y,z,[[0,.25,.25],[.10,.25,.25]],lux?10:6)}
 function crystal(x,y,z,r,h){loft(5,x,y,z,[[0,r*.22,r*.22],[h*.24,r,r],[h*.73,r*.65,r*.65],[h,.015,.015]],6,Math.PI/6)}
 if(neutral){loft(1,0,0,0,[[0,.27,.27],[.09,.40,.40],[.16,.32,.32]],12);crystal(0,.16,0,role==="relic"?.31:.22,role==="relic"?.9:.56);if(role==="relic")for(let i=0;i<4;i++){let a=i*Math.PI/2;crystal(Math.cos(a)*.36,.06,Math.sin(a)*.36,.08,.32)}}
 else{
 box(0,0,0,0,4.6,.20,3.8);box(1,0,.18,0,4.3,.08,3.5);
 if(role==="farm"){for(let i=0;i<4;i++){box(3,(i-1.5)*.90,.26,0,.75,.12,2.9);for(let j=0;j<7;j++){const x=(i-1.5)*.90,z=(j-3)*.40;loft(4,x,.38,z,[[0,.07,.07],[.24,.15,.15],[.52,.02,.02]],6);loft(1,x,.62,z,[[0,.08,.08],[.13,.04,.04]],5)}}for(const x of [-2,2])for(const z of [-1.5,1.5])column(x,z,.72);}
 else if(role==="guard_post"){loft(0,0,.26,0,[[0,1.25,1.25],[.35,1.1,1.1],[2.45,.85,.85],[2.7,1.3,1.3],[3.0,1.3,1.3]],lux?10:8);for(let i=0;i<8;i++){let a=i*Math.PI/4;box(1,Math.cos(a)*1.13,3.15,Math.sin(a)*1.13,.38,.44,.38)}for(const x of [-.85,.85])column(x,.8,2.4);crystal(0,3.18,0,.31,.90);}
 else {const w=role==="barracks"?3.6:role==="house"?2.7:3.2,d=role==="market"?2.4:2.8,h=role==="barracks"?2.3:role==="depot"?1.65:1.9;
  if(role!=="market"){box(0,0,.26,0,w,h,d);box(3,0,.28,d/2+.015,.86,1.26,.12);for(const x of [-w*.32,w*.32]){box(3,x,1.14,d/2+.04,.45,.48,.08);box(1,x,1.64,d/2+.07,.57,.10,.13)}}
  for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])column(x,z,h+.12);
  roof(0,h+.31,0,w+.45,d+.45,lux?.80:1.10);
  if(role==="depot"||role==="market")for(let i=0;i<4;i++){let x=(i-1.5)*.64;box(3,x,.26,1.54,.48,.43,.48);box(1,x,.67,1.54,.51,.08,.51)}
  if(role==="barracks"){for(const x of [-1.2,1.2]){box(3,x,.26,1.63,.18,2.6,.18);box(2,x,1.85,1.67,.62,.88,.08);box(1,x,2.73,1.67,.68,.09,.12)}}
  if(role==="house"){box(0,.75,h+.45,-.64,.40,.83,.42);box(1,.75,h+1.28,-.64,.49,.11,.49)}
  if(role==="market"){for(const x of [-.95,.95]){box(3,x,.26,0,1.30,.77,.68);for(let i=0;i<3;i++)loft(4,x+(i-1)*.35,1.04,0,[[0,.12,.12],[.13,.15,.15],[.24,.04,.04]],8)}}
  for(let i=0;i<5;i++)box(1,(i-2)*w/5,h+.14,d/2+.03,.21,.12,.15);
  }
 }
 const buffers=[],views=[],accessors=[];let offset=0;
 function acc(arr,k){const bytes=new Uint8Array(arr.length*4),dv=new DataView(bytes.buffer);for(let i=0;i<arr.length;i++)dv.setFloat32(i*4,arr[i],true);views.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target:34962});offset+=bytes.length;buffers.push(bytes);const a={bufferView:views.length-1,componentType:5126,count:arr.length/k,type:"VEC"+k};if(k===3){a.min=Array(3).fill(Infinity);a.max=Array(3).fill(-Infinity);for(let i=0;i<arr.length;i++){const x=dv.getFloat32(i*4,true);a.min[i%3]=Math.min(a.min[i%3],x);a.max[i%3]=Math.max(a.max[i%3],x)}}accessors.push(a);return accessors.length-1}
 const primitives=gs.flatMap((g,i)=>g.p.length?[{material:i,mode:4,attributes:{POSITION:acc(g.p,3),NORMAL:acc(g.n,3),TEXCOORD_0:acc(g.uv,2)}}]:[]);
 const doc={asset:{version:"2.0",generator:"BUKLOD original RTS economy review"},scene:0,scenes:[{nodes:[0]}],nodes:[{name:id,mesh:0}],meshes:[{name:id,primitives}],materials,accessors,bufferViews:views,buffers:[{byteLength:offset}],extras:{id,reviewOnly:true,gameplayCollider:false}};
 const j=JSON.stringify(doc),n=j.length+(4-j.length%4)%4,bytes=new Uint8Array(28+n+offset),v=new DataView(bytes.buffer);[0x46546c67,2,bytes.length,n,0x4e4f534a].forEach((x,i)=>v.setUint32(i*4,x,true));for(let i=0;i<n;i++)bytes[20+i]=i<j.length?j.charCodeAt(i):32;v.setUint32(20+n,offset,true);v.setUint32(24+n,0x004e4942,true);let at=28+n;for(const b of buffers){bytes.set(b,at);at+=b.length}return {id,team,role,triangles,bytes}
 });
}
const out=new URL('./ReviewOutput/economy/',import.meta.url);mkdirSync(out,{recursive:true});
const rows=economyModels().map(({bytes,...r})=>{const file=r.id+'.glb';writeFileSync(new URL(file,out),bytes);return {...r,file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}});
writeFileSync(new URL('manifest.json',out),JSON.stringify({status:'REVIEW_ONLY',models:rows},null,2)+'\n');console.log('Generated',rows.length,'economy review assets');
