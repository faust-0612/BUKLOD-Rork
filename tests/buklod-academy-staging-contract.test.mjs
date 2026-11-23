import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const from=(path)=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const catalog=JSON.parse(from('src/data/university/buklodUniversityCatalog.json'));
const byCode=new Map(catalog.credentials.map(c=>[c.code,c]));

test('BUKLOD Academy keeps 53 internally branded awards and no public university identity',()=>{
 assert.equal(catalog.program,'BUKLOD Academy of Higher Learning');
 assert.equal(catalog.issuer,'MZB Ministry Inc.');
 assert.equal(catalog.signatory_printed_name,'Faustino Jr M Gabut, PhD');
 assert.equal(byCode.size,53);
 const expected={certificate:32,diploma:9,bachelors_completion:7,masters_completion:5};
 for(const [tier,count] of Object.entries(expected))
  assert.equal(catalog.credentials.filter(c=>c.award_type===tier).length,count);
 for(const c of catalog.credentials){
  assert.ok(c.min_uc>0&&Number.isInteger(c.min_uc));
  assert.ok(c.existing_evidence_gate?.length>8);
  assert.ok(!/^(Bachelor|Master) of /i.test(c.title),'Do not promise formal degrees');
 }
});

test('all award prerequisites form an acyclic valid monotonic ladder',()=>{
 const seen=new Set(),active=new Set();
 const visit=(code)=>{
  assert.ok(byCode.has(code),'Unknown prerequisite '+code);
  if(seen.has(code))return;
  assert.ok(!active.has(code),'Cycle: '+code);
  active.add(code);
  const c=byCode.get(code);
  for(const pre of c.prerequisite_credentials){
   assert.ok(byCode.get(pre).min_uc<=c.min_uc,'UC reversal '+pre+' -> '+code);
   visit(pre);
  }
  active.delete(code);seen.add(code);
 };
 for(const c of catalog.credentials)visit(c.code);
 assert.equal(seen.size,53);
});

test('no individual achievement paper, no points/QMP changes, and feature defaults off',()=>{
 const migration=from('supabase/migrations/20261124020000_buklod_university_internal_academic_r1.sql');
 assert.match(migration,/enabled boolean not null default false/);
 assert.match(migration,/alter table public\.buklod_university_awards enable row level security/);
 assert.match(migration,/unique\(user_id,source_module,source_key\)/);
 assert.match(migration,/get_buklod_stage_progress|BU-ACADEMY-5|credential_evidence/);
 assert.doesNotMatch(migration,/update public\.buklod_points_ledger/i);
 const paper=from('supabase/functions/buklod-academy-paper-v1/index.ts');
 assert.match(paper,/BUKLOD ACADEMY OF HIGHER LEARNING/);
 assert.match(paper,/MZB MINISTRY INC/);
 assert.match(paper,/Faustino Jr M Gabut, PhD/);
 assert.match(paper,/buklod-university-issuer/);
 assert.match(paper,/auth\.user\.id/);
 assert.match(paper,/award\.status!=='ISSUED'/);
 assert.match(paper,/paper_status:'READY'/);
 assert.doesNotMatch(paper,/INDIVIDUAL ACHIEVEMENT/);
});

test('SALIKSIK research is submission, verification and human review, not automatic unverified UC',()=>{
 const sql=from('supabase/migrations/20261124021000_buklod_academy_saliksik_research_bridge.sql');
 assert.match(sql,/status='SUBMITTED'/);
 assert.match(sql,/public\.is_system_admin\(\)/);
 assert.match(sql,/Cannot review your own research/);
 assert.match(sql,/citations_verified/);
 assert.match(sql,/originality_checked/);
 assert.match(sql,/on conflict\(user_id,source_module,source_key\) do nothing/);
 const files=['src/app/academy/research.tsx','src/app/admin/academy-research-review.tsx'];
 for(const f of files) assert.match(from(f),/SALIKSIK|Research/);
});

test('recipients, learning entry and sound effects are connected without app-wide overlay loops',()=>{
 assert.match(from('src/app/admin/index.tsx'),/\/admin\/academy-recipients/);
 assert.match(from('src/app/admin/index.tsx'),/\/admin\/academy-research-review/);
 assert.match(from('src/app/(tabs)/learn.tsx'),/router\.push\('\/academy'/);
 assert.match(from('src/app/academy/index.tsx'),/\/academy\/research/);
 const sound=from('src/lib/buklodSounds.ts');
 for(const cue of ['university_certificate','university_diploma','university_bachelors','university_masters'])
  assert.ok(sound.includes(cue),cue);
 assert.match(from('src/components/university/BuklodAcademicCompletionCelebration.tsx'),/BUKLOD ACADEMY OF HIGHER LEARNING/);
});
