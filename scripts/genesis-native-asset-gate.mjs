/** Season 2 Genesis: fail-closed native-art provenance gate; zero paid APIs. */
import {readFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,isAbsolute,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const REQUIRED_ROLES=Object.freeze(['cosmic-skybox','kingdom-environment','rigged-character','cinematic-audio']);
const LICENSES=new Set(['CC0-1.0','CC-BY-4.0','BUKLOD-ORIGINAL','PIXABAY-CONTENT-LICENSE']);
const EXTENSIONS=new Set(['.webp','.png','.ktx2','.glb','.riv','.ogg','.m4a']);
const HOSTS=new Set(['kenney.nl','polyhaven.com','freesound.org','pixabay.com']);
const MAX_BYTES=15*1024*1024;
function inside(root,path){
  const rel=relative(root,path);
  return rel!==''&&rel!=='..'&&!rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))&&!isAbsolute(rel);
}
export function auditGenesisAssets(manifest,repoRoot,{forRelease=false,requiredRoles=REQUIRED_ROLES}={}){
  const errors=[],accepted=new Set(),ids=new Set();
  const root=resolve(repoRoot,'assets/season2/genesis/approved');
  if(!manifest||manifest.schemaVersion!==1||!Array.isArray(manifest.assets))
    return {ok:false,errors:['Invalid Genesis asset manifest'],readyRoles:[]};
  for(const a of manifest.assets){
    if(!a||typeof a.id!=='string'||!/^[a-z0-9][a-z0-9-]{2,79}$/.test(a.id)){errors.push('Invalid asset id');continue;}
    if(ids.has(a.id)){errors.push('Duplicate asset id: '+a.id);continue;}
    ids.add(a.id);
    if(!REQUIRED_ROLES.includes(a.role))errors.push(a.id+': unknown asset role');
    if(!LICENSES.has(a.license))errors.push(a.id+': license not approved');
    if(a.license==='BUKLOD-ORIGINAL'){
      if(a.sourceUrl!=null)errors.push(a.id+': original art must use internal rights evidence');
    }else{
      try{
        const u=new URL(a.sourceUrl);
        if(u.protocol!=='https:'||!HOSTS.has(u.hostname))errors.push(a.id+': untrusted source');
      }catch{errors.push(a.id+': invalid source URL');}
    }
    if(a.status==='candidate'){
      if(a.relativePath||a.sha256)errors.push(a.id+': unimported candidate claims asset bytes');
      continue;
    }
    if(a.status!=='approved'){errors.push(a.id+': invalid status');continue;}
    if(!/^[0-9a-f]{64}$/.test(a.sha256??'')){errors.push(a.id+': missing SHA-256');continue;}
    if(typeof a.relativePath!=='string'||!a.relativePath||isAbsolute(a.relativePath)){
      errors.push(a.id+': invalid relative path');continue;
    }
    const absolute=resolve(root,a.relativePath);
    if(!inside(root,absolute)||!EXTENSIONS.has(extname(absolute).toLowerCase())){
      errors.push(a.id+': unsafe path/type');continue;
    }
    if(a.license==='CC-BY-4.0'&&!a.attribution)errors.push(a.id+': attribution missing');
    if(a.license==='BUKLOD-ORIGINAL'&&!a.rightsEvidence)errors.push(a.id+': ownership not documented');
    if(a.license==='PIXABAY-CONTENT-LICENSE'&&!a.commercialUseReviewed)
      errors.push(a.id+': specific commercial use not reviewed');
    if(a.role==='cinematic-audio'&&(!a.mastered||!Number.isFinite(a.integratedLufs)||
      !(a.sampleRateHz>=44100)||!a.contentIdCleared))errors.push(a.id+': audio not mastered or rights-unverified');
    try{
      const real=realpathSync(absolute);
      if(!inside(root,real))throw new Error('asset path escapes approved directory');
      const bytes=readFileSync(real);
      if(!bytes.length||bytes.length>MAX_BYTES)throw new Error('size outside bounded budget');
      if(createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw new Error('hash mismatch');
      if(!errors.some(e=>e.startsWith(a.id+':')))accepted.add(a.role);
    }catch(e){errors.push(a.id+': '+e.message);}
  }
  if(forRelease)for(const role of requiredRoles)if(!accepted.has(role))
    errors.push('Release blocked: no approved local '+role);
  return {ok:errors.length===0,errors,readyRoles:[...accepted].sort()};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
  const manifest=JSON.parse(readFileSync(resolve(root,'assets/season2/genesis/sources.json'),'utf8'));
  const mode=process.argv.includes('--release')?'release':'audit';
  const result=auditGenesisAssets(manifest,root,{forRelease:mode==='release'});
  console.log(JSON.stringify({mode,...result},null,2));
  if(!result.ok)process.exitCode=1;
}
