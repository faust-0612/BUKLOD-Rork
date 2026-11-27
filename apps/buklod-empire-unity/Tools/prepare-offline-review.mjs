// Single offline preparation entrypoint. No Unity build, network, approval or production writes.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,unlinkSync,mkdirSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {heroPipelineHash} from './hero-pipeline-hash.mjs';
import {validateHeroGlb} from './validate-hero-skin.mjs';
export function validateRows(doc,key,expected,status,read,hash){
 if(!doc||doc.status!==status||!Array.isArray(doc[key])||doc[key].length!==expected.length)throw Error("Invalid manifest: "+key);
 const missing=new Set(expected),rows=[];
 for(const row of doc[key]){
  if(!row||typeof row.file!=="string"||!missing.delete(row.file)||!Number.isSafeInteger(row.bytes)||row.bytes<=0||typeof row.sha256!=="string"||!(/^[a-f0-9]{64}$/).test(row.sha256))throw Error("Invalid or duplicate asset identity");
  const data=read(row.file);
  if(data.length!==row.bytes||hash(data)!==row.sha256)throw Error("Asset integrity mismatch: "+row.file);
  rows.push({file:row.file,bytes:row.bytes,sha256:row.sha256});
 }
 if(missing.size)throw Error("Missing assets");
 return rows.sort((a,b)=>a.file.localeCompare(b.file));
}
const tools=fileURLToPath(new URL('./',import.meta.url)),project=fileURLToPath(new URL('../',import.meta.url)),output=join(tools,'ReviewOutput'),receipt=join(output,'offline-preparation.json');
const sha=data=>createHash('sha256').update(data).digest('hex');
const heroIds=['phan','quin','van','christian','lhen','ace','ellusur','jawo','mitch','niel','angel','vhen','trudice'];
const factionIds=['lux','tenebra'].flatMap(team=>['infantry','siege','gunner','mage','healer',...(team==='lux'?['aron','lira','daren','serah','kiel','miko']:['rogar','velin','kael','mora','zed','taro'])].map(id=>team+'_'+id));
const creatures=['azure_stag','crimson_wolf','emerald_serpent','golden_scarab','stone_golem','river_spirit','wind_falcon','ancient_sentinel','colossal_guardian'];
const resources=['wood','stone','crystal','gold','food'];
const economy=['lux','tenebra'].flatMap(team=>['depot','guard_post','farm','barracks','market','house'].map(x=>team+'_'+x)).concat(['field_pickup','relic_pickup']);
const glb=ids=>ids.map(id=>id+'.glb'),png=ids=>ids.flatMap(id=>['base','mask','normal'].map(role=>id+'_'+role+'.png'));
const specs=[
 ['heroes','heroes',glb(heroIds),'RIGGED_PROCEDURAL_REVIEW_ONLY'],
 ['hero-lod','heroes',glb(heroIds),'LOD_REVIEW_ONLY'],
 ['variants','variants',glb(heroIds.flatMap(id=>['original','radiant','nightwatch'].map(s=>id+'_'+s))),'COSMETIC_REVIEW_ONLY'],
 ['premium-factions','models',glb(factionIds),'REVIEW_ONLY'],
 ['wildlife','models',glb(creatures.concat(resources)),'REVIEW_ONLY'],
 ['economy','models',glb(economy),'REVIEW_ONLY'],
 ['faction-materials','textures',png(['armor','trim','fabric','leather','skin']),'REVIEW_ONLY'],
 ['wildlife-materials','textures',png(['fur','scales','chitin','stone','spirit','feather','armor']),'REVIEW_ONLY'],
 ['environment-materials','textures',['soil','grass','stone','paving','timber','metal'].map(x=>x+'.tga'),'REVIEW_ONLY'],
 ['presentation-audio','clips',['menu','battle','ambience','victory','defeat','draw','entrance',...Array.from({length:9},(_,i)=>'creature_attack_'+i),...Array.from({length:9},(_,i)=>'creature_defeat_'+i)].map(x=>x+'.wav'),'REVIEW_ONLY']
];
function run(command,args,env=process.env){
 console.log('>',command,...args);const result=spawnSync(command,args,{cwd:project,env,stdio:'inherit'});
 if(result.error)throw result.error;if(result.status!==0)throw Error('Failed stage: '+args.join(' '));
}
function audit(heroSize,sharedSize){
 const full=new Map(),pipeline=heroPipelineHash(project);
 const groups=specs.map(([dir,key,expected,status])=>{
  const folder=join(output,dir),data=readFileSync(join(folder,'manifest.json')),doc=JSON.parse(data);
  if(dir==='heroes'&&doc.heroes?.some(row=>row.textureResolution!==heroSize||row.geometryRevision!=='original-sculpted-geometry-v10'||row.sourcePipelineSha256!==pipeline||row.jointTriangles!==2048))throw Error('Hero geometry cache needs targeted refresh: use --refresh-heroes');
  if(dir.endsWith('-materials')&&doc.resolution!==sharedSize)throw Error('Unexpected shared resolution: '+dir);
  const rows=validateRows(doc,key,expected,status,file=>{
   const bytes=readFileSync(join(folder,file));
   if(dir==='heroes'||dir==='hero-lod')validateHeroGlb(bytes,file.slice(0,-4));
   return bytes;
  },sha);
  if(dir==='heroes')for(const row of doc.heroes){if(row.id+'.glb'!==row.file||!heroIds.includes(row.id))throw Error('Hero identity drift');full.set(row.id,row.sha256);}
  if(dir==='hero-lod'||dir==='variants')for(const row of doc[key]){
   const id=dir==='hero-lod'?row.id:row.hero;
   if(!full.has(id)||row.sourceSha256!==full.get(id)||row.file!==(dir==='hero-lod'?id:id+'_'+row.style)+'.glb')throw Error('Stale derived hero asset: '+row.file);
  }
  return {directory:dir,manifestSha256:sha(data),rows};
 });
 const folder=join(output,'environment'),data=readFileSync(join(folder,'manifest.json')),map=JSON.parse(data);
 const model=readFileSync(join(folder,'genesis_rift_premium_review.glb')),original=readFileSync(join(tools,'AssetCandidates','genesis_rift_environment_review.glb'));
 if(map.status!=='REVIEW_ONLY'||map.bytes!==model.length||map.sha256!==sha(model)||map.sourceSha256!==sha(original))throw Error('Premium map integrity mismatch');
 groups.push({directory:'environment',manifestSha256:sha(data),rows:[{file:'genesis_rift_premium_review.glb',bytes:model.length,sha256:sha(model)}]});
 return groups;
}
const args=process.argv.slice(2),verify=args[0]==='--verify',refresh=args[0]==='--refresh-heroes',offset=verify||refresh?1:0;
if(args.length>offset+2)throw Error('Usage: node Tools/prepare-offline-review.mjs [--verify|--refresh-heroes] [hero-size] [shared-size]');
const heroSize=Number(args[offset]||1024),sharedSize=Number(args[offset+1]||2048);
if(![256,1024,2048,4096].includes(heroSize)||![1024,2048,4096].includes(sharedSize))throw Error('Unsupported texture resolution');
mkdirSync(output,{recursive:true});
if(existsSync(receipt))unlinkSync(receipt); // failed/incomplete runs must not leave a successful aggregate receipt
const refreshMarker=join(output,'.hero-refresh-incomplete');
if(refresh||!verify)writeFileSync(refreshMarker,'hero refresh in progress\n');
if(verify&&existsSync(refreshMarker))throw Error('Incomplete hero refresh: use --refresh-heroes');
if(refresh){
 const python=process.env.PYTHON||'python3',env={...process.env,BUKLOD_REVIEW_TEXTURE_SIZE:String(heroSize),PYTHONOPTIMIZE:''};
 run(python,['-c','import numpy, PIL'],env);
 run(python,['Tools/prepare-hero-review.py'],env);
 run(python,['-c',"import sys,json,pathlib; sys.path.insert(0,'Tools'); from validate_skill_motions import validate_roster; root=pathlib.Path('Tools/ReviewOutput/heroes'); (root/'skill-motion-verification.json').write_text(json.dumps(validate_roster(root),indent=2)+'\\n')"],env);
 for(const script of ['variant_review.py','prepare_hero_lod.py'])run(python,['Tools/'+script],env);
}else if(!verify){
 const python=process.env.PYTHON||'python3',env={...process.env,BUKLOD_REVIEW_TEXTURE_SIZE:String(heroSize),PYTHONOPTIMIZE:''};
 run(python,['-c','import numpy, PIL'],env);
 run(python,['Tools/prepare-review-assets.py'],env);
 for(const script of ['premium-faction-review.mjs','premium-environment-review.mjs','wildlife-review.mjs','economy-review.mjs','presentation-audio.mjs'])run(process.execPath,['Tools/'+script]);
 for(const script of ['faction_materials.py','wildlife_surfaces.py'])run(python,['Tools/'+script,'--size',String(sharedSize)],env);
 run(process.execPath,['Tools/environment-materials.mjs',String(sharedSize)]);
}
const groups=audit(heroSize,sharedSize);
const doc={status:'OFFLINE_ASSETS_VERIFIED_REVIEW_ONLY',heroSize,sharedSize,groups,files:groups.reduce((n,g)=>n+g.rows.length,0),bytes:groups.reduce((n,g)=>n+g.rows.reduce((s,r)=>s+r.bytes,0),0),unityVerified:false,productionApproved:false};
writeFileSync(receipt+'.tmp',JSON.stringify(doc,null,2)+'\n');renameSync(receipt+'.tmp',receipt);
if(existsSync(refreshMarker))unlinkSync(refreshMarker);
console.log('Offline candidate manifest verified:',doc.files,'files;',doc.bytes,'bytes. Unity, runtime and art acceptance still required.');
