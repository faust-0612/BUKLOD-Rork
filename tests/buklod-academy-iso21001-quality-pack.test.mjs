import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const catalog=JSON.parse(read('src/data/university/buklodUniversityCatalog.json'));
const quality=JSON.parse(read('src/data/academy/bahlQualityCurriculumFramework.json'));
const credits=new Map(catalog.credentials.map(c=>[c.code,c]));
const sourceIds=new Set(quality.source_modules.map(s=>s.id));

test('BAHL quality pack links to same 53 credential catalog, not a second award system',()=>{
 assert.equal(quality.catalog_version,catalog.catalog_version);
 assert.equal(quality.authoritative_catalog,'src/data/university/buklodUniversityCatalog.json');
 assert.equal(quality.credential_profiles.length,53);
 assert.deepEqual(new Set(quality.credential_profiles.map(p=>p.code)),new Set(credits.keys()));
 assert.equal(quality.accreditation_status,'NOT_ISO_CERTIFIED_NOT_CHED_RECOGNIZED');
 assert.equal(quality.publication_state,'DEV_DRAFT_OFF');
 for(const p of quality.credential_profiles){
  assert.ok(p.learning_outcomes.length>=2);
  assert.equal(p.status,'DRAFT_MAPPING_NOT_PROOF_OF_COMPLETION');
  assert.ok(credits.has(p.code));
  assert.ok(p.source_candidates.length);
  p.source_candidates.forEach(s=>assert.ok(sourceIds.has(s),s+' missing'));
 }
});
test('No shadow lessons, fraudulent academic or ad-based credits',()=>{
 assert.equal(quality.source_modules.length,14);
 assert.equal(quality.competency_matrix.length,16);
 assert.ok(quality.exclusions.some(x=>/AdMob/.test(x)));
 for(const s of quality.source_modules){
  assert.ok(s.existing.length>10);
  assert.ok(s.outcomes.length&&s.evidence.length&&s.protection.length);
 }
 assert.deepEqual(quality.pilot_programs.map(x=>x.code),['C-S01','C-D01','C-F01']);
 quality.pilot_programs.forEach(x=>assert.ok(credits.has(x.code)));
 const base=read('supabase/migrations/20261124020000_buklod_university_internal_academic_r1.sql');
 assert.match(base,/enabled boolean not null default false/);
});
test('Document pack covers scope, published-source approval, privacy, internal audit and ISO honesty',()=>{
 const docs=['README.md','QUALITY_MANUAL_v1.md','CURRICULUM_MASTER_v1.md','ACADEMIC_ASSESSMENT_SOP_v1.md','RECORDS_FORMS_AND_AUDIT_v1.md','ISO21001_GAP_AND_RELEASE_GATE_v1.md'].map(x=>read('docs/academy/'+x));
 for(const d of docs.slice(0,3))assert.match(d,/non-formal|non.formal/i);
 assert.match(docs[1],/Quality policy/i);
 assert.match(docs[2],/101.103|101–103/);
 assert.match(docs[3],/appeal/i);
 assert.match(docs[4],/Internal audit/i);
 assert.match(docs[5],/NOT AUDIT-READY/);
 assert.ok(docs.every(d=>!/is ISO certified|ISO certification has been achieved/i.test(d)));
});
