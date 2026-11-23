import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
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
  assert.match(blocked.stderr,/No rights-verified private models to stage/);
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
 assert.match(scene,/FileAccess\.file_exists\("res:\/\/3d\/private\/private_t1_sentinel\.glb"\)/);
 assert.match(scene,/_model\("rig_knight"\)/);
 assert.match(scene,/server_settlement": false/);
});
