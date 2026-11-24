import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
function generate(){
 const profiles={phan:["mallet","#5f9750"],quin:["compass","#45c3d1"],van:["shield","#739eea"],christian:["banner","#cc5345"],lhen:["tambourine","#b27adc"],ace:["cuff","#54b8ad"],ellusur:["crook","#d0a95b"],jawo:["radio","#c77c42"],mitch:["caddy","#5789bb"],niel:["loudhailer","#aa84df"],angel:["ledger","#49b5b7"],vhen:["trowel","#8fbd58"],trudice:["puppet","#d990b5"]};
 const pi=Math.PI,enc=(bytes)=>{const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";let s="";for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1]||0,c=bytes[i+2]||0,n=(a<<16)|(b<<8)|c;s+=chars[n>>18]+chars[n>>12&63]+(i+1<bytes.length?chars[n>>6&63]:"=")+(i+2<bytes.length?chars[n&63]:"=");}return s;};
 const output={};
 for(const [hero,[gear,hex]] of Object.entries(profiles)){
  const groups=Array.from({length:4},()=>({pos:[],norm:[]}));
  const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255);
  const tri=(m,a,b,c)=>{const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);if(l<1e-8)return;groups[m].pos.push(...a,...b,...c);for(let i=0;i<3;i++)groups[m].norm.push(...n.map(x=>x/l));};
  const quad=(m,a,b,c,d)=>{tri(m,a,b,c);tri(m,a,c,d);};
  const box=(m,c,s)=>{const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(a=>a.map((x,i)=>c[i]+x*s[i]/2));for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[0,1,5,4],[3,7,6,2]])quad(m,...f.map(i=>v[i]));};
  const lathe=(m,c,rows,n=32,axis="y")=>{const point=(row,a)=>{const [h,r]=row,x=Math.cos(a)*r,z=Math.sin(a)*r;return axis==="z"?[c[0]+x,c[1]-z,c[2]+h]:[c[0]+x,c[1]+h,c[2]+z];};for(let j=0;j<rows.length-1;j++)for(let i=0;i<n;i++){let a=i*2*pi/n,b=(i+1)*2*pi/n;quad(m,point(rows[j],a),point(rows[j+1],a),point(rows[j+1],b),point(rows[j],b));}};
  const ring=(m,c,r,t,n=40)=>{const point=(a,b)=>[c[0]+(r+t*Math.cos(b))*Math.cos(a),c[1]+(r+t*Math.cos(b))*Math.sin(a),c[2]+t*Math.sin(b)];for(let i=0;i<n;i++)for(let j=0;j<8;j++){let a=i*2*pi/n,b=(i+1)*2*pi/n,d=j*pi/4,e=(j+1)*pi/4;quad(m,point(a,d),point(b,d),point(b,e),point(a,e));}};
  const jewel=(c,r)=>lathe(3,c,[[-r,0],[-r*.15,r*.72],[r*.2,r],[r,0]],8);
  const shaft=(h)=>{lathe(2,[0,0,0],[[-h/2,0],[-h/2,.05],[h/2,.05],[h/2,0]],20);for(let i=0;i<5;i++)lathe(1,[0,-h*.34+i*.065,0],[[-.012,.051],[.012,.055]],20);};
  const disk=(c,r)=>{lathe(0,c,[[-.045,0],[-.045,r*.94],[-.025,r],[.025,r],[.045,r*.94],[.045,0]],48,"z");ring(1,[c[0],c[1],c[2]+.047],r*.84,.015);};
  const studs=(c,r,n)=>{for(let i=0;i<n;i++){const a=i*2*pi/n;jewel([c[0]+r*Math.cos(a),c[1]+r*Math.sin(a),c[2]],.028);}};
  switch(gear){
   case "mallet":shaft(1);box(0,[0,.46,0],[.52,.22,.23]);for(const x of [-.23,.23])box(1,[x,.46,0],[.06,.25,.26]);jewel([0,.46,.145],.10);break;
   case "compass":disk([0,0,0],.32);studs([0,0,.065],.27,8);lathe(3,[0,0,.07],[[-.19,0],[-.03,.035],[.16,0]],8);jewel([0,0,.09],.055);break;
   case "shield":disk([0,0,0],.38);ring(1,[0,0,.08],.29,.021);studs([0,0,.08],.33,10);jewel([0,0,.1],.14);break;
   case "banner":shaft(1.35);box(2,[.21,.36,0],[.40,.52,.035]);box(1,[.21,.62,0],[.43,.04,.055]);box(1,[.21,.10,0],[.43,.04,.055]);jewel([.21,.36,.045],.10);break;
   case "tambourine":ring(1,[0,0,0],.30,.041);disk([0,0,-.025],.24);for(let i=0;i<12;i++){let a=i*pi/6;lathe(1,[.30*Math.cos(a),.30*Math.sin(a),0],[[-.045,0],[-.045,.045],[.045,.045],[.045,0]],12,"z");}jewel([0,0,.04],.08);break;
   case "cuff":lathe(2,[0,0,0],[[-.17,.19],[.17,.19]],36);for(let y of [-.17,.17])lathe(1,[0,y,0],[[-.025,.19],[.025,.21]],36);box(0,[0,0,.19],[.25,.23,.09]);jewel([0,0,.26],.09);break;
   case "crook":shaft(1.15);for(let i=0;i<=14;i++){let a=pi*i/14;lathe(1,[.17*(1-Math.cos(a)),.57+.17*Math.sin(a),0],[[-.045,0],[-.02,.052],[.02,.052],[.045,0]],12);}jewel([.34,.57,0],.07);break;
   case "radio":box(2,[0,0,0],[.29,.46,.17]);box(0,[0,.06,.095],[.24,.27,.045]);box(3,[0,.08,.122],[.16,.10,.015]);for(let i=0;i<4;i++)box(1,[0,-.10+i*.026,.12],[.14,.009,.02]);lathe(1,[.10,.30,0],[[0,.015],[.24,.012]],12);jewel([.10,.55,0],.035);break;
   case "caddy":box(0,[0,0,0],[.40,.35,.24]);box(1,[0,-.16,0],[.42,.04,.26]);for(let i=0;i<3;i++){let x=(i-1)*.11;lathe(2,[x,.24,0],[[-.15,.023],[.16,.023]],12);jewel([x,.42,0],.045);}jewel([0,0,.145],.09);break;
   case "loudhailer":lathe(0,[0,0,0],[[-.3,.08],[-.23,.10],[.25,.27],[.28,.27],[.28,.22],[-.18,.065]],40,"z");ring(1,[0,0,.28],.25,.025);box(2,[0,-.17,-.12],[.10,.22,.12]);jewel([0,0,-.32],.07);break;
   case "ledger":box(2,[0,0,0],[.39,.51,.13]);box(0,[0,0,.075],[.40,.53,.035]);for(let x of [-.17,.17])box(1,[x,0,.10],[.025,.52,.028]);for(let i=0;i<4;i++)box(1,[0,-.14+i*.07,.103],[.22,.012,.025]);jewel([0,.16,.12],.065);break;
   case "trowel":shaft(.57);lathe(0,[0,.37,0],[[-.15,0],[-.11,.15],[.1,.14],[.23,0]],8);jewel([0,.38,.09],.075);break;
   case "puppet":box(1,[0,.26,0],[.42,.05,.05]);box(1,[0,.26,0],[.05,.05,.35]);jewel([0,.31,0],.065);for(let x of [-.14,.14]){box(2,[x,-.05,0],[.014,.55,.014]);jewel([x,-.34,0],.045);}lathe(0,[0,-.25,0],[[-.13,0],[-.07,.10],[.10,.10],[.15,0]],16);break;
  }
  const doc={asset:{version:"2.0",generator:"BUKLOD original procedural relic review"},scene:0,scenes:[{nodes:[0]}],nodes:[{name:hero+"_"+gear+"_relic_review",mesh:0}],meshes:[{primitives:[]}],materials:[{name:"forged_alloy",pbrMetallicRoughness:{baseColorFactor:[.32,.36,.42,1],metallicFactor:.86,roughnessFactor:.25}},{name:"gilded_trim",pbrMetallicRoughness:{baseColorFactor:[.93,.72,.32,1],metallicFactor:.91,roughnessFactor:.23}},{name:"grip_and_fabric",pbrMetallicRoughness:{baseColorFactor:[.06,.08,.12,1],metallicFactor:.04,roughnessFactor:.64}},{name:"hero_relic_inlay",pbrMetallicRoughness:{baseColorFactor:[...rgb,1],metallicFactor:.35,roughnessFactor:.18},emissiveFactor:rgb.map(x=>x*.13)}],buffers:[],bufferViews:[],accessors:[],extras:{reviewOnly:true,hero,gear,visualApproval:false}};
  const bytes=[];const add=(arr,bounds)=>{const start=bytes.length;const f=new Float32Array(arr);const v=new Uint8Array(f.buffer);for(const n of v)bytes.push(n);const bv=doc.bufferViews.push({buffer:0,byteOffset:start,byteLength:v.length,target:34962})-1;const a={bufferView:bv,componentType:5126,count:arr.length/3,type:"VEC3"};if(bounds){a.min=[0,1,2].map(k=>Math.min(...arr.filter((_,i)=>i%3===k)));a.max=[0,1,2].map(k=>Math.max(...arr.filter((_,i)=>i%3===k)));}return doc.accessors.push(a)-1;};
  let triangles=0;for(let m=0;m<groups.length;m++){const g=groups[m];if(!g.pos.length)continue;triangles+=g.pos.length/9;doc.meshes[0].primitives.push({attributes:{POSITION:add(g.pos,true),NORMAL:add(g.norm,false)},material:m,mode:4});}
  doc.buffers.push({byteLength:bytes.length,uri:"data:application/octet-stream;base64,"+enc(bytes)});doc.extras.triangles=triangles;
  output[hero+"_relic.gltf"]=JSON.stringify(doc);
 }
 return output;
}
const out=fileURLToPath(new URL('./AssetCandidates/PremiumCommerce/',import.meta.url));mkdirSync(out,{recursive:true});for(const [name,data] of Object.entries(generate()))writeFileSync(join(out,name),data+'\n');
