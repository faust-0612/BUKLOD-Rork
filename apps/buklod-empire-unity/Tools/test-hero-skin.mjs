import {validateHeroSkin,validateHeroGlb,parseHeroGlb} from './validate-hero-skin.mjs';
function fixture(){
 const bytes=new Uint8Array(4096),v=new DataView(bytes.buffer);let offset=0;
 const boneNames=["Root","Head","Chest","Mantle","Hand_L","Hand_R","Forearm_L","Forearm_R","UpperArm_L","UpperArm_R","Shin_L","Shin_R","ReviewHair","ReviewEye_L","ReviewEye_R"];
 const doc={asset:{version:"2.0"},buffers:[{byteLength:bytes.length}],bufferViews:[],accessors:[],nodes:boneNames.map(name=>({name})),skins:[{joints:boneNames.map((_,i)=>i),skeleton:0}],meshes:[{primitives:[]}],materials:[{name:"hair"}],animations:["Idle","Walk","Run","Attack","Skill","Primary","Secondary","Ultimate","LegacyUltimate","Hit","Death","Victory"].map(name=>({name}))};
 doc.nodes[1].children=[12,13,14];doc.nodes.push({mesh:0,skin:0});
 function add(type,component,width,rows){
  offset=Math.ceil(offset/4)*4;const length=rows.length*width*(component===5123?2:4),start=offset;
  const bi=doc.bufferViews.push({buffer:0,byteOffset:start,byteLength:length})-1;
  for(const row of rows)for(const x of row){if(component===5123){v.setUint16(offset,x,true);offset+=2;}else{v.setFloat32(offset,x,true);offset+=4;}}
  return doc.accessors.push({bufferView:bi,componentType:component,count:rows.length,type})-1;
 }
 doc.skins[0].inverseBindMatrices=add("MAT4",5126,16,boneNames.map(()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));
 const attributes={POSITION:add("VEC3",5126,3,[[0,0,0],[1,0,0],[0,1,0]]),NORMAL:add("VEC3",5126,3,Array(3).fill([0,0,1])),TEXCOORD_0:add("VEC2",5126,2,[[0,0],[1,0],[0,1]]),TANGENT:add("VEC4",5126,4,Array(3).fill([1,0,0,1])),JOINTS_0:add("VEC4",5123,4,[[12,13,0,0],[12,14,0,0],[12,1,0,0]]),WEIGHTS_0:add("VEC4",5126,4,Array(3).fill([.75,.25,0,0]))};
 doc.meshes[0].primitives.push({attributes,indices:add("SCALAR",5123,1,[[0],[1],[2]]),material:0});
 const at=key=>doc.bufferViews[doc.accessors[key].bufferView].byteOffset;
 return {doc,bytes,v,attributes,at};
}
function runFixtures(){
 const checks=[];
 const valid=fixture(),result=validateHeroSkin(valid.doc,valid.bytes,"phan");
 if(result.hairWeights!==3||result.vertices!==3||result.bones!==15||result.triangles!==1)throw Error("Valid fixture failed");
 checks.push("valid skin");
 const failures=[
 ["out-of-range bone",x=>x.v.setUint16(x.at(x.attributes.JOINTS_0),999,true)],
 ["nonfinite position",x=>x.v.setFloat32(x.at(x.attributes.POSITION),NaN,true)],
 ["unnormalized weights",x=>x.v.setFloat32(x.at(x.attributes.WEIGHTS_0),.9,true)],
 ["unsorted weights",x=>{const p=x.at(x.attributes.WEIGHTS_0);x.v.setFloat32(p,.25,true);x.v.setFloat32(p+4,.75,true);}],
 ["index overflow",x=>x.v.setUint16(x.at(x.doc.meshes[0].primitives[0].indices),3,true)],
 ["truncated buffer view",x=>x.doc.bufferViews[x.doc.accessors[x.attributes.POSITION].bufferView].byteLength=4],
 ["missing hair parent",x=>x.doc.nodes[1].children=[13,14]],
 ["missing eye parent",x=>x.doc.nodes[1].children=[12,13]],
 ["unweighted eye",x=>x.v.setUint16(x.at(x.attributes.JOINTS_0)+10,1,true)],
 ["hair on nonhair material",x=>x.doc.materials[0].name="skin"],
 ["missing animation",x=>x.doc.animations.pop()]
 ];
 for(const [name,mutate] of failures){const x=fixture();mutate(x);let rejected=false;try{validateHeroSkin(x.doc,x.bytes,"phan");}catch{rejected=true;}if(!rejected)throw Error("Accepted invalid "+name);checks.push(name);}
 return checks;
}
console.log('Hero GLB skin fixtures passed:',runFixtures().join(', '));

// End-to-end envelope + skin fixture using actual Node Buffer.
const x=fixture(),json=Buffer.from(JSON.stringify(x.doc)),padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);
header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+x.bytes.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
binHeader.writeUInt32LE(x.bytes.length,0);binHeader.writeUInt32LE(0x004e4942,4);
const glb=Buffer.concat([header,padded,binHeader,Buffer.from(x.bytes)]);
if(validateHeroGlb(glb,"phan").triangles!==1)throw Error("Valid GLB wrapper rejected");
for(const [offset,bad] of [[0,0],[8,glb.length+1],[12,3],[16,0],[20+padded.length,99],[24+padded.length,0x304e4942]]){
 const broken=Buffer.from(glb);broken.writeUInt32LE(bad,offset);let rejected=false;try{parseHeroGlb(broken)}catch{rejected=true;}if(!rejected)throw Error("Accepted invalid GLB envelope at "+offset);
}
console.log("Hero GLB envelope fixtures passed: 7");
