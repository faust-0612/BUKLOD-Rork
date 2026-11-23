#!/usr/bin/env node
/**
 * BUKLOD Genesis private Library intake.
 *
 * --inspect : read-only inventory of local owner materializations (no upload)
 * --stage   : stage ONLY rights-approved, SHA-pinned, self-contained GLB models
 *             and selected safe ZIP-contained GLBs into a private build folder.
 *             Output is consumed by the Godot pack build only under an explicit
 *             BUKLOD_GENESIS_PRIVATE_ASSETS=true release gate.
 *
 * Private source bytes / license proofs never enter GitHub logs or the repo.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,statSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const template=JSON.parse(readFileSync(path.join(root,'godot/empire-arena/library/private_library_intake.inventory.json'),'utf8'));
const inputDir=path.resolve(process.env.BUKLOD_GENESIS_PRIVATE_ASSET_DIR||'/mnt/data/genesis-private-assets');
const outputDir=path.resolve(process.env.BUKLOD_GENESIS_PRIVATE_STAGE_DIR||path.join(root,'build/genesis-private-library'));
const reportPath=path.join(outputDir,'inspection-report.json');
const rightsPath=process.env.BUKLOD_GENESIS_PRIVATE_RIGHTS_FILE;
const stage=process.argv.includes('--stage');
const inspect=process.argv.includes('--inspect');
if((stage?1:0)+(inspect?1:0)!==1)throw Error('Specify exactly one of --stage or --inspect');
assert.equal(template.schema,1);
assert.ok(Array.isArray(template.directModels)&&Array.isArray(template.sourceArchives));
assert.ok(inputDir!==path.resolve(root),'Refusing repo root as private asset input');
assert.ok(outputDir!==inputDir,'Output cannot overwrite input Library files');
const LIMIT_TOTAL=130*1024*1024, LIMIT_GLB=40*1024*1024, LIMIT_ENTRY=40*1024*1024;
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const formatPath=s=>typeof s==='string'&&/^[A-Za-z0-9_. \/+\-()]+$/.test(s)&&
 !s.startsWith('/')&&!s.startsWith('\\')&&!s.split(/[\\/]/).includes('..')&&!s.includes('\\');
const safeId=s=>typeof s==='string'&&/^private_[a-z0-9_]{2,64}$/.test(s);
function parseGlb(bytes){
  assert.ok(bytes.length>=32&&bytes.length<=LIMIT_GLB,'GLB outside mobile bounds');
  assert.equal(bytes.toString('ascii',0,4),'glTF','not a binary glTF 2.0');
  assert.equal(bytes.readUInt32LE(4),2,'not glTF 2.0');
  assert.equal(bytes.readUInt32LE(8),bytes.length,'GLB length mismatch');
  const jsonSize=bytes.readUInt32LE(12);
  assert.ok(jsonSize>=8&&jsonSize<bytes.length-20,'invalid GLB JSON size');
  assert.equal(bytes.toString('ascii',16,20),'JSON','missing JSON chunk');
  const doc=JSON.parse(bytes.subarray(20,20+jsonSize).toString('utf8').trim());
  assert.equal(doc.asset?.version,'2.0','GLTF 2.0 metadata missing');
  assert.ok(doc.meshes?.length>0&&doc.meshes.length<400,'missing/bounded 3D meshes');
  assert.ok((doc.nodes?.length??0)<3000,'excessive scene nodes');
  assert.ok((doc.animations?.length??0)<300,'excessive animations');
  assert.ok(!doc.extensionsRequired?.some(s=>/draco|meshopt|lights_punctual/i.test(s)),
    'unsupported required extension');
  for(const b of doc.buffers||[]){
    if(b.uri&&!String(b.uri).startsWith('data:'))
      throw Error('Non-self-contained GLB references an external buffer');
  }
  for(const b of doc.images||[]){
    if(b.uri&&!String(b.uri).startsWith('data:'))
      throw Error('Non-self-contained GLB references an external image');
  }
  return {meshes:doc.meshes.length,skins:doc.skins?.length||0,animations:doc.animations?.length||0};
}
function validateWav(bytes){
  assert.ok(bytes.length>=44&&bytes.length<=12*1024*1024,'WAV outside bounds');
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WAVE');
  return {bytes:bytes.length};
}
const localRights=(()=>{
  if(!rightsPath)return {schema:1,assets:[]};
  const file=path.resolve(rightsPath);
  assert.ok(file!==path.join(root,'godot/empire-arena/library/private_library_intake.inventory.json'),
    'Rights attestations must be external');
  const rights=JSON.parse(readFileSync(file,'utf8'));
  assert.equal(rights.schema,1);
  assert.ok(Array.isArray(rights.assets),'rights.assets[] required');
  return rights;
})();
function verifiedRights(filename,sourceHash){
  const right=localRights.assets.find(r=>r.file===filename&&r.sha256===sourceHash);
  if(!right||right.allowCommercialRedistribution!==true||
     !['CC0-1.0','CC-BY-4.0','BUKLOD-OWNED','COMMERCIAL-LICENSE'].includes(right.licenseId))return null;
  const proofPath=right.proofFile;
  assert.ok(typeof proofPath==='string'&&proofPath.length>3,'license evidence path missing');
  const evidence=path.resolve(path.dirname(path.resolve(rightsPath)),proofPath);
  assert.ok(existsSync(evidence)&&statSync(evidence).isFile(),'license evidence not accessible');
  assert.ok(statSync(evidence).size>0&&statSync(evidence).size<3*1024*1024,'license evidence out of bounds');
  if(right.licenseId==='CC-BY-4.0')
    assert.ok(typeof right.attribution==='string'&&right.attribution.length>5,'Attribution required');
  return {license:right.licenseId,licenseEvidenceSha256:sha256(readFileSync(evidence)),
    attribution:right.attribution||'',includeEntries:right.includeEntries||[]};
}
function listZip(file){
  const listed=execFileSync('unzip',['-Z1',file],{encoding:'utf8',timeout:30000,maxBuffer:3*1024*1024})
    .trim().split(/\r?\n/);
  assert.ok(listed.length>0&&listed.length<=12000,'ZIP entry count exceeds review bound');
  assert.ok(listed.every(formatPath),'ZIP has unsafe filename/path');
  return listed;
}
function kindOf(name){
  const ext=path.extname(name).toLowerCase();
  return ['.glb','.gltf','.fbx','.blend','.wav','.png','.webp','.unity','.anim'].includes(ext)?ext.slice(1):'other';
}
const records=[],staged=[];
let stagedBytes=0;
const seenIds=new Set();
function storeModel(id,bytes,originalFile,sha,rights,inner=''){
  assert.ok(safeId(id),'Unsafe private pack model ID');
  assert.ok(!seenIds.has(id),'Duplicate private model ID: '+id);
  const info=parseGlb(bytes);
  const bytesHash=sha256(bytes);
  assert.ok(stagedBytes+bytes.length<=LIMIT_TOTAL,'Private game content exceeds Android OTA budget');
  const dest=path.join(outputDir,'approved',id+'.glb');
  mkdirSync(path.dirname(dest),{recursive:true});
  writeFileSync(dest,bytes,{flag:'wx',mode:0o600});
  stagedBytes+=bytes.length; seenIds.add(id);
  staged.push({id,sha256:bytesHash,sourceArchiveSha256:sha,bytes:bytes.length,
    sourceFile:originalFile,sourceEntry:inner,rightsStatus:'verified',license:rights.license,
    licenseEvidenceSha256:rights.licenseEvidenceSha256,
    attribution:rights.attribution,meshes:info.meshes,skins:info.skins,animations:info.animations});
}
for(const item of [...template.directModels,...template.sourceArchives]){
  assert.ok(formatPath(item.file)&&!item.file.includes('/'),'Bad private Library basename');
  const candidate=path.join(inputDir,item.file);
  const row={file:item.file,kind:path.extname(item.file).toLowerCase(),
    purpose:item.purpose,status:'NOT_MATERIALIZED',expectedBytes:item.bytes};
  records.push(row);
  if(!existsSync(candidate))continue;
  const stats=statSync(candidate);
  if(!stats.isFile()||stats.size!==item.bytes){row.status='SOURCE_SIZE_MISMATCH';continue;}
  row.actualBytes=stats.size;
  const bytes=readFileSync(candidate);
  const sourceHash=sha256(bytes);
  row.sha256=sourceHash;
  let approved=null;
  try{approved=verifiedRights(item.file,sourceHash);}
  catch(error){row.rightsError=String(error.message).slice(0,140);}
  row.rightsApproved=!!approved;
  try{
    if(row.kind==='.glb'){
      const parsed=parseGlb(bytes);
      row.model=parsed; row.status=approved?'RIGHTS_APPROVED_GLB':'COMPATIBLE_GLB_RIGHTS_PENDING';
      if(stage&&approved)storeModel(item.id,bytes,item.file,sourceHash,approved);
    }else if(row.kind==='.zip'){
      const names=listZip(candidate);
      row.formatCounts=names.reduce((acc,n)=>{const k=kindOf(n);acc[k]=(acc[k]||0)+1;return acc;},{});
      row.entries=names.length;
      row.status=approved?'ZIP_REVIEWED_RIGHTS_APPROVED':'ZIP_CONTENTS_INSPECTED_RIGHTS_PENDING';
      if(stage&&approved){
        assert.ok(Array.isArray(approved.includeEntries)&&approved.includeEntries.length<=10,'too many explicit ZIP assets');
        for(const request of approved.includeEntries){
          assert.ok(formatPath(request.entry)&&!request.entry.endsWith('/'),'unsafe ZIP selection');
          assert.ok(names.includes(request.entry),'Selected file not in ZIP');
          assert.ok(['.glb','.wav'].includes(path.extname(request.entry).toLowerCase()),'format requires conversion');
          const extracted=execFileSync('unzip',['-p',candidate,request.entry],
            {timeout:45000,maxBuffer:LIMIT_ENTRY+2048});
          assert.ok(extracted.length<LIMIT_ENTRY,'ZIP entry too large');
          if(request.entry.toLowerCase().endsWith('.glb'))
            storeModel(request.id,extracted,item.file,sourceHash,approved,request.entry);
          else{
            validateWav(extracted);
            row.audioCandidateVerified=true; // Audio is not auto-published.
          }
        }
      }
    }else if(row.kind==='.unitypackage'){
      row.status='NEEDS_UNITY_CONVERSION_AND_LICENSE_REVIEW';
    }else if(row.kind==='.rar'){
      row.status='NEEDS_RAR_EXTRACTOR_CONVERSION_AND_LICENSE_REVIEW';
    }
  }catch(error){row.status='REJECTED_FORMAT_OR_INTEGRITY';row.problem=String(error.message).slice(0,170);}
}
mkdirSync(outputDir,{recursive:true});
const report={schema:1,source:'PRIVATE_LIBRARY_LOCAL_ONLY',mode:stage?'STAGE':'INSPECT',files:records,
  summary:{materialized:records.filter(r=>r.actualBytes).length,
    glbCompatible:records.filter(r=>/GLB_RIGHTS_PENDING|RIGHTS_APPROVED_GLB/.test(r.status)).length,
    zipInspected:records.filter(r=>/ZIP_/.test(r.status)).length,
    rightsApproved:records.filter(r=>r.rightsApproved).length,
    stagedModels:staged.length,stagedBytes}};
writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{mode:0o600});
if(stage){
  const manifest={schema:1,source:'PRIVATE_LIBRARY_LOCAL_ONLY',rightsStatus:'verified',
    releaseAuthority:'DEV_PREVIEW_ONLY',models:staged,totalBytes:stagedBytes};
  writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
}
console.log('BUKLOD_PRIVATE_ASSET_INTAKE '+JSON.stringify(report.summary));
if(stage&&staged.length===0)throw Error('No rights-verified private models to stage: nothing to publish');
