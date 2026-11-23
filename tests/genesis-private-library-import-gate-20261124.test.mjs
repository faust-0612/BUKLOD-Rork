import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const input=JSON.parse(read('godot/empire-arena/library/private_library_intake.inventory.json'));
test('Owner Library input inventory explicitly binds five GLBs and large animation/Unity archives',()=>{
 assert.equal(input.schema,1);
 assert.equal(input.directModels.length,5);
 assert.equal(input.sourceArchives.length,9);
 assert.equal(new Set(input.directModels.map(x=>x.id)).size,5);
 assert.ok(input.directModels.every(x=>/^private_[a-z0-9_]+$/.test(x.id)&&x.bytes>10000));
 assert.ok(input.sourceArchives.some(x=>x.file.endsWith('.unitypackage')));
 assert.ok(input.sourceArchives.some(x=>x.file.endsWith('.rar')));
 assert.ok(input.sourceArchives.some(x=>x.file==='Mocap_Pack_07_Everyday_Actions_2.zip'));
 assert.equal(input.status.includes('no private file rights'),true);
});
test('Importer audits locally materialized assets, never publishes unauthenticated bytes',()=>{
 const source=read('scripts/genesis-private-library-intake.mjs');
 for(const token of [
  'BUKLOD_GENESIS_PRIVATE_ASSET_DIR','BUKLOD_GENESIS_PRIVATE_RIGHTS_FILE',
  'verifiedRights','sha256','formatPath','parseGlb','listZip',
  'allowCommercialRedistribution','licenseEvidenceSha256','SOURCE_SIZE_MISMATCH',
  'ZIP_CONTENTS_INSPECTED_RIGHTS_PENDING','NEEDS_UNITY_CONVERSION_AND_LICENSE_REVIEW',
  'NEEDS_RAR_EXTRACTOR_CONVERSION_AND_LICENSE_REVIEW'])
  assert.ok(source.includes(token),token);
 assert.doesNotMatch(source,/https:\/\/|axios\(|fetch\(|service_role|admin_token/);
 assert.ok(source.includes('GLB length mismatch'));
 assert.ok(source.includes('Non-self-contained GLB references an external buffer'));
});
test('No private Library assets in source: missing artifacts inspect cleanly but fail stage',()=>{
 const source=path.join(root,'scripts/genesis-private-library-intake.mjs');
 const temp=mkdtempSync(path.join(tmpdir(),'buklod-asset-intake-'));
 const stage=path.join(temp,'build');
 const env={...process.env,BUKLOD_GENESIS_PRIVATE_ASSET_DIR:path.join(temp,'inputs'),
   BUKLOD_GENESIS_PRIVATE_STAGE_DIR:stage};
 delete env.BUKLOD_GENESIS_PRIVATE_RIGHTS_FILE;
 try{
  const output=execFileSync(process.execPath,[source,'--inspect'],{cwd:root,env,encoding:'utf8'});
  assert.match(output,/BUKLOD_PRIVATE_ASSET_INTAKE/);
  const report=JSON.parse(readFileSync(path.join(stage,'inspection-report.json'),'utf8'));
  assert.equal(report.summary.materialized,0);
  assert.equal(report.summary.stagedModels,0);
  assert.equal(report.files.length,14);
  assert.equal(existsSync(path.join(stage,'manifest.json')),false);
  const blocked=spawnSync(process.execPath,[source,'--stage'],{cwd:root,env,encoding:'utf8'});
  assert.notEqual(blocked.status,0);
  assert.match(blocked.stderr,/No rights-verified private assets to stage/);
  assert.equal(existsSync(path.join(stage,'manifest.json')),false);
 }finally{rmSync(temp,{recursive:true,force:true})}
});
test('Native 3D preview keeps public 22-model fallback when private license gate disabled',()=>{
 const scene=read('godot/empire-arena/scripts/premium_world_3d.gd');
 const pack=read('scripts/build-empire-godot-pack.mjs');
 const prepare=read('scripts/genesis-prepare-godot-ota-pack.mjs');
 assert.match(pack,/BUKLOD_GENESIS_PRIVATE_ASSETS === 'true'/);
 assert.match(pack,/licenseEvidenceSha256/);
 assert.match(pack,/privateBytes<130\*1024\*1024/);
 assert.match(pack,/data\/private_3d_manifest\.json/);
 assert.match(prepare,/data\/private_3d_manifest\.json/);
 assert.match(scene,/PRIVATE_MODEL_IDS/);
 assert.match(scene,/FileAccess\.file_exists\("res:\/\/3d\/private\/" \+ private_avatar \+ "\.glb"\)/);
 assert.match(scene,/_model\("rig_knight"\)/);
 assert.match(scene,/server_settlement": false/);
});

test('Whole private Library scan finds nested archive/audio/VFX files without publishing bytes',()=>{
 const source=path.join(root,'scripts/genesis-private-library-intake.mjs');
 const temp=mkdtempSync(path.join(tmpdir(),'buklod-full-inventory-'));
 const inputs=path.join(temp,'input');
 const output=path.join(temp,'out');
 try{
  mkdirSync(path.join(inputs,'Animation'),{recursive:true});
  mkdirSync(path.join(inputs,'Audio'),{recursive:true});
  const wave=Buffer.alloc(60);
  wave.write('RIFF',0);wave.writeUInt32LE(52,4);wave.write('WAVE',8);
  writeFileSync(path.join(inputs,'Audio','original cue.wav'),wave);
  const png=Buffer.alloc(112);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(png,0);
  writeFileSync(path.join(inputs,'Animation','reveal.png'),png);
  const env={...process.env,BUKLOD_GENESIS_PRIVATE_ASSET_DIR:inputs,
   BUKLOD_GENESIS_PRIVATE_STAGE_DIR:output};
  delete env.BUKLOD_GENESIS_PRIVATE_RIGHTS_FILE;
  execFileSync(process.execPath,[source,'--inspect'],{cwd:root,env});
  const report=JSON.parse(readFileSync(path.join(output,'inspection-report.json'),'utf8'));
  assert.equal(report.summary.discovered,2);
  assert.equal(report.summary.materialized,2);
  assert.equal(report.summary.stagedAudio,0);
  assert.equal(report.summary.stagedVisual,0);
  const byName=new Map(report.files.map(x=>[x.file,x]));
  assert.equal(byName.get('Audio/original cue.wav').status,'COMPATIBLE_WAV_RIGHTS_PENDING');
  assert.equal(byName.get('Animation/reveal.png').status,'COMPATIBLE_PNG_RIGHTS_PENDING');
  assert.equal(existsSync(path.join(output,'manifest.json')),false);
 }finally{rmSync(temp,{recursive:true,force:true});}
});

test('Optional original Library VFX is license-and-hash gated and retains public fallback',()=>{
 const pack=read('scripts/build-empire-godot-pack.mjs');
 const prep=read('scripts/genesis-prepare-godot-ota-pack.mjs');
 const world=read('godot/empire-arena/scripts/premium_world_3d.gd');
 assert.match(pack,/BUKLOD_GENESIS_PRIVATE_FX === 'true'/);
 assert.match(pack,/REVIEWED_IN_GAME_USE_ONLY/);
 assert.match(pack,/licenseProof/);
 assert.match(pack,/fx\.sha256/);
 assert.match(prep,/data\/private_fx_manifest\.json/);
 assert.match(world,/PRIVATE_ARENA_FX/);
 assert.match(world,/FileAccess\.file_exists\(PRIVATE_ARENA_FX\)/);
 assert.match(world,/_model\("rig_knight"\)/);
});
test('Explicit rights-gated owner WAV and PNG stage with exact SHA into private build, not GitHub',()=>{
 const source=path.join(root,'scripts/genesis-private-library-intake.mjs');
 const temp=mkdtempSync(path.join(tmpdir(),'buklod-stage-fixtures-'));
 const inputDir=path.join(temp,'Library');
 const stageDir=path.join(temp,'PrivateBuild');
 try{
   mkdirSync(path.join(inputDir,'Sound'),{recursive:true});
   const wav=Buffer.alloc(160);
   wav.write('RIFF',0);wav.writeUInt32LE(152,4);wav.write('WAVE',8);
   const png=Buffer.alloc(112);
   Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
   const wfile='Sound/recording.wav',pfile='Sound/effect.png';
   writeFileSync(path.join(inputDir,wfile),wav);
   writeFileSync(path.join(inputDir,pfile),png);
   writeFileSync(path.join(temp,'rights.txt'),'Synthetic fixture rights evidence for unit-test files only');
   const sha=x=>createHash('sha256').update(x).digest('hex');
   const grants=[{file:wfile,sha256:sha(wav),licenseId:'BUKLOD-OWNED',
     allowCommercialRedistribution:true,proofFile:'rights.txt'},
     {file:pfile,sha256:sha(png),licenseId:'BUKLOD-OWNED',
     allowCommercialRedistribution:true,proofFile:'rights.txt'}];
   const rightsFile=path.join(temp,'rights.json');
   writeFileSync(rightsFile,JSON.stringify({schema:1,assets:grants}));
   const env={...process.env,BUKLOD_GENESIS_PRIVATE_ASSET_DIR:inputDir,
     BUKLOD_GENESIS_PRIVATE_STAGE_DIR:stageDir,
     BUKLOD_GENESIS_PRIVATE_RIGHTS_FILE:rightsFile};
   execFileSync(process.execPath,[source,'--stage'],{cwd:root,env});
   const data=JSON.parse(readFileSync(path.join(stageDir,'manifest.json'),'utf8'));
   assert.equal(data.source,'PRIVATE_LIBRARY_LOCAL_ONLY');
   assert.equal(data.models.length,0);
   assert.equal(data.audio.length,1);
   assert.equal(data.visuals.length,1);
   for(const it of [...data.audio,...data.visuals]){
     assert.equal(it.rightsStatus,'verified');
     assert.match(it.licenseEvidenceSha256,/^[a-f0-9]{64}$/);
     const bytes=readFileSync(path.join(stageDir,'approved',it.id+it.ext));
     assert.equal(bytes.length,it.bytes);
     assert.equal(sha(bytes),it.sha256);
   }
   assert.equal(data.totalBytes,wav.length+png.length);
 }finally{rmSync(temp,{recursive:true,force:true});}
});
