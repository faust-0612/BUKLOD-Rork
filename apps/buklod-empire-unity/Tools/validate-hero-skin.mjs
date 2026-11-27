// Original candidate GLB skin validation; no Unity import or visual approval.
export function validateHeroSkin(doc,binary,id){
 const fail=message=>{throw Error(id+": "+message)};
 if(!doc||doc.asset?.version!=="2.0"||doc.buffers?.length!==1||doc.buffers[0].byteLength!==binary.byteLength)fail("GLB buffer contract");
 const view=new DataView(binary.buffer,binary.byteOffset,binary.byteLength),views=doc.bufferViews,accessors=doc.accessors,nodes=doc.nodes;
 if(!Array.isArray(views)||!Array.isArray(accessors)||!Array.isArray(nodes)||doc.skins?.length!==1||doc.meshes?.length!==1)fail("Incomplete hero GLB");
 const countOk=n=>Number.isSafeInteger(n)&&n>=0;
 function region(i){
  const v=views[i];if(!v||v.buffer!==0||!countOk(v.byteOffset??0)||!countOk(v.byteLength)||v.byteLength===0||(v.byteOffset??0)%4!==0||(v.byteOffset??0)+v.byteLength>binary.byteLength)fail("Invalid bufferView "+i);
  return v;
 }
 function acc(i,type,component,width){
  const a=accessors[i];if(!a||a.sparse||a.normalized||a.type!==type||a.componentType!==component||!countOk(a.count)||!a.count)fail("Invalid "+type+" accessor "+i);
  const v=region(a.bufferView),bytes=component===5123?2:4,stride=bytes*width,offset=a.byteOffset??0;
  if(!countOk(offset)||offset%bytes||(v.byteStride??stride)!==stride||offset+a.count*stride>v.byteLength)fail("Accessor outside bufferView "+i);
  const start=(v.byteOffset??0)+offset;
  return {count:a.count,read:(n,k)=>component===5123?view.getUint16(start+n*stride+k*bytes,true):view.getFloat32(start+n*stride+k*bytes,true)};
 }
 for(let i=0;i<views.length;i++)region(i);
 const skin=doc.skins[0],joints=skin.joints;
 if(!Array.isArray(joints)||!joints.length||new Set(joints).size!==joints.length||joints.some(j=>!countOk(j)||!nodes[j])||!joints.includes(skin.skeleton))fail("Invalid skin joints");
 const names=joints.map(j=>nodes[j].name);
 if(new Set(names).size!==names.length||!["Root","Head","Chest","Mantle","Hand_L","Hand_R","Forearm_L","Forearm_R","UpperArm_L","UpperArm_R","Shin_L","Shin_R"].every(n=>names.includes(n)))fail("Canonical bone identity missing");
 const hair=names.indexOf("ReviewHair"),head=names.indexOf("Head");
 const hood=id==="ellusur"||id==="vhen";
 if(hood?hair>=0:hair<0)fail("Unexpected secondary hair rig");
 if(hair>=0&&!nodes[joints[head]].children?.includes(joints[hair]))fail("Hair joint not attached to head");
 const bind=acc(skin.inverseBindMatrices,"MAT4",5126,16);
 if(bind.count!==joints.length)fail("Bind pose count mismatch");
 for(let i=0;i<bind.count;i++)for(let k=0;k<16;k++)if(!Number.isFinite(bind.read(i,k)))fail("Nonfinite bind pose");
 if(!nodes.some(n=>n.mesh===0&&n.skin===0))fail("Missing skinned mesh node");
 let vertices=0,triangles=0,hairWeights=0;
 const primitives=doc.meshes[0].primitives;
 if(!Array.isArray(primitives)||!primitives.length)fail("No primitives");
 for(const p of primitives){
  if((p.mode??4)!==4||!doc.materials?.[p.material])fail("Invalid primitive material/mode");
  const a=p.attributes??{},pos=acc(a.POSITION,"VEC3",5126,3),normal=acc(a.NORMAL,"VEC3",5126,3),uv=acc(a.TEXCOORD_0,"VEC2",5126,2),tan=acc(a.TANGENT,"VEC4",5126,4),ji=acc(a.JOINTS_0,"VEC4",5123,4),w=acc(a.WEIGHTS_0,"VEC4",5126,4),ix=acc(p.indices,"SCALAR",5123,1);
  if([normal,uv,tan,ji,w].some(x=>x.count!==pos.count)||ix.count%3)fail("Geometry attribute count mismatch");
  for(let i=0;i<ix.count;i++)if(ix.read(i,0)>=pos.count)fail("Triangle index out of bounds");
  for(let i=0;i<pos.count;i++){
   let sum=0;
   for(let k=0;k<4;k++){
    const joint=ji.read(i,k),weight=w.read(i,k);
    if(joint>=joints.length||!Number.isFinite(weight)||weight<0||weight>1)fail("Invalid skin influence");
    if(k>0&&weight>w.read(i,k-1)+1e-6)fail("Unsorted skin influence");
    if(joint===hair&&weight>0){if(doc.materials[p.material].name!=="hair")fail("Hair weight on non-hair material");hairWeights++;}
    sum+=weight;
   }
   if(Math.abs(sum-1)>1e-4)fail("Unnormalized skin weights");
   for(const [attribute,width] of [[pos,3],[normal,3],[uv,2],[tan,4]])for(let k=0;k<width;k++)if(!Number.isFinite(attribute.read(i,k)))fail("Nonfinite geometry attribute");
  }
  vertices+=pos.count;triangles+=ix.count/3;
 }
 if(hair>=0&&!hairWeights)fail("Hair joint has no weighted vertices");
 if(doc.animations?.length!==12||new Set(doc.animations.map(a=>a.name)).size!==12)fail("Missing named animation clips");
 const namesExpected=["Idle","Walk","Run","Attack","Skill","Primary","Secondary","Ultimate","LegacyUltimate","Hit","Death","Victory"];
 if(namesExpected.some(n=>!doc.animations.some(a=>a.name===n)))fail("Canonical animation missing");
 for(const image of doc.images??[]){
  const v=region(image.bufferView),start=v.byteOffset??0;
  if(image.mimeType!=="image/png"||v.byteLength<8||view.getUint32(start,false)!==0x89504e47||view.getUint32(start+4,false)!==0x0d0a1a0a)fail("Invalid embedded PNG header");
 }
 return {vertices,triangles,bones:joints.length,hairWeights};
}
export function parseHeroGlb(data){
 if(data.length<28||data.readUInt32LE(0)!==0x46546c67||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length)throw Error("Invalid GLB header");
 const n=data.readUInt32LE(12);
 if(n%4||n+28>data.length||data.readUInt32LE(16)!==0x4e4f534a||data.readUInt32LE(24+n)!==0x004e4942||data.readUInt32LE(20+n)!==data.length-28-n)throw Error("Invalid GLB chunks");
 return {doc:JSON.parse(data.toString("utf8",20,20+n)),binary:data.subarray(28+n)};
}
export function validateHeroGlb(data,id){
 const {doc,binary}=parseHeroGlb(data);return validateHeroSkin(doc,binary,id);
}
