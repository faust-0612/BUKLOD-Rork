import {validateHeroSkin} from './validate-hero-skin.mjs';
function fixture(){
 const bytes=new Uint8Array(4096),v=new DataView(bytes.buffer);let offset=0;
 const boneNames=["Root","Head","Chest","Mantle","Hand_L","Hand_R","Forearm_L","Forearm_R","UpperArm_L","UpperArm_R","Shin_L","Shin_R","ReviewHair"];
 const doc={asset:{version:"2.0"},buffers:[{byteLength:bytes.length}],bufferViews:[],accessors:[],nodes:boneNames.map(name=>({name})),skins:[{joints:boneNames.map((_,i)=>i),skeleton:0}],meshes:[{primitives:[]}],materials:[{name:"hair"}],animations:["Idle","Walk","Run","Attack","Skill","Primary","Secondary","Ultimate","LegacyUltimate","Hit","Death","Victory"].map(name=>({name}))};
 doc.nodes[1].children=[12];doc.nodes.push({mesh:0,skin:0});
 function add(type,component,width,rows){
  offset=Math.ceil(offset/4)*4;const length=rows.length*width*(component===5123?2:4),start=offset;
  const bi=doc.bufferViews.push({buffer:0,byteOffset:start,byteLength:length})-1;
  for(const row of rows)for(const x of row){if(component===5123){v.setUint16(offset,x,true);offset+=2;}else{v.setFloat32(offset,x,true);offset+=4;}}
  return doc.accessors.push({bufferView:bi,componentType:component,count:rows.length,type})-1;
 }
 doc.skins[0].inverseBindMatrices=add("MAT4",5126,16,boneNames.map(()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]));
 const attributes={POSITION:add("VEC3",5126,3,[[0,0,0],[1,0,0],[0,1,0]]),NORMAL:add("VEC3",5126,3,Array(3).fill([0,0,1])),TEXCOORD_0:add("VEC2",5126,2,[[0,0],[1,0],[0,1]]),TANGENT:add("VEC4",5126,4,Array(3).fill([1,0,0,1])),JOINTS_0:add("VEC4",5123,4,Array(3).fill([12,1,0,0])),WEIGHTS_0:add("VEC4",5126,4,Array(3).fill([.75,.25,0,0]))};
 doc.meshes[0].primitives.push({attributes,indices:add("SCALAR",5123,1,[[0],[1],[2]]),material:0});
 const at=key=>doc.bufferViews[doc.accessors[key].bufferView].byteOffset;
 return {doc,bytes,v,attributes,at};
}
function runFixtures(){
 const checks=[];
 const valid=fixture(),result=validateHeroSkin(valid.doc,valid.bytes,"phan");
 if(result.hairWeights!==3||result.vertices!==3||result.bones!==13||result.triangles!==1)throw Error("Valid fixture failed");
 checks.push("valid skin");
 const failures=[
 ["out-of-range bone",x=>x.v.setUint16(x.at(x.attributes.JOINTS_0),999,true)],
 ["nonfinite position",x=>x.v.setFloat32(x.at(x.attributes.POSITION),NaN,true)],
 ["unnormalized weights",x=>x.v.setFloat32(x.at(x.attributes.WEIGHTS_0),.9,true)],
 ["unsorted weights",x=>{const p=x.at(x.attributes.WEIGHTS_0);x.v.setFloat32(p,.25,true);x.v.setFloat32(p+4,.75,true);}],
 ["index overflow",x=>x.v.setUint16(x.at(x.doc.meshes[0].primitives[0].indices),3,true)],
 ["truncated buffer view",x=>x.doc.bufferViews[x.doc.accessors[x.attributes.POSITION].bufferView].byteLength=4],
 ["missing hair parent",x=>x.doc.nodes[1].children=[]],
 ["hair on nonhair material",x=>x.doc.materials[0].name="skin"],
 ["missing animation",x=>x.doc.animations.pop()]
 ];
 for(const [name,mutate] of failures){const x=fixture();mutate(x);let rejected=false;try{validateHeroSkin(x.doc,x.bytes,"phan");}catch{rejected=true;}if(!rejected)throw Error("Accepted invalid "+name);checks.push(name);}
 return checks;
}
console.log('Hero GLB skin fixtures passed:',runFixtures().join(', '));
