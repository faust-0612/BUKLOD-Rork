import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const register=JSON.parse(read('src/data/academy/bahlIso21001ControlRegister.json'));
const catalog=JSON.parse(read('src/data/university/buklodUniversityCatalog.json'));
const quality=JSON.parse(read('src/data/academy/bahlQualityCurriculumFramework.json'));

test('36 ISO-aligned controls span clauses 4 to 10; no self-certification claims',()=>{
 assert.equal(register.standard,'ISO 21001:2025');
 assert.equal(register.controls.length,36);
 assert.deepEqual([...new Set(register.controls.map(x=>x.clause))].sort(),['4','5','6','7','8','9','10']);
 assert.equal(register.quality_claim_allowed,false);
 assert.equal(register.certification_claim_allowed,false);
 assert.equal(register.readiness_release_gate,'FAIL_CLOSED_UNTIL_VERIFIED');
 assert.equal(new Set(register.controls.map(x=>x.id)).size,36);
 for(const c of register.controls){
  assert.ok(c.accountable_role.length>3);
  assert.ok(c.required_objective_evidence.length>20);
  assert.ok(['DESIGNED_NOT_VALIDATED','IN_PROGRESS','BLOCKED','NEEDS_RECHECK','VERIFIED'].includes(c.implementation_status));
  assert.ok(Array.isArray(c.evidence_records));
  if(c.implementation_status==='VERIFIED'){
   assert.equal(c.test_result,'PASS');
   assert.ok(c.evidence_records.length>0);
   assert.ok(c.approved_by && c.approved_at);
  }
 }
});
test('quality framework and academic source catalog remain reconciled',()=>{
 assert.equal(catalog.credentials.length,53);
 assert.equal(quality.credential_profiles.length,53);
 assert.equal(quality.source_modules.length,14);
 assert.equal(quality.competency_matrix.length,16);
 assert.equal(quality.catalog_version,catalog.catalog_version);
});
test('evidence gate honestly reports operational blockers and strict mode fails closed',()=>{
 const script=new URL('../scripts/academy/iso21001-readiness-check.mjs',import.meta.url);
 const normal=spawnSync(process.execPath,[script.pathname],{encoding:'utf8'});
 assert.equal(normal.status,0,normal.stderr);
 const status=JSON.parse(normal.stdout);
 assert.ok(status.operationally_verified>=0);
 assert.ok(status.operationally_verified<=register.controls.length);
 assert.ok(['NOT_READY','ALL_DOCUMENTED_CONTROLS_VERIFIED_FURTHER_EXTERNAL_AUDIT_STILL_REQUIRED'].includes(status.current_status));
 assert.ok(Array.isArray(status.blocking_requirements));
 const strict=spawnSync(process.execPath,[script.pathname,'--strict'],{encoding:'utf8'});
 assert.equal(strict.status,status.current_status==='NOT_READY'?1:0);
 assert.equal(JSON.parse(strict.stdout).certification_claim_allowed,false);
});
