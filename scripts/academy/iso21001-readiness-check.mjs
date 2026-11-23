#!/usr/bin/env node
// Minimal evidence gate. No dependency, no secrets, no live API request.
// Reports structural readiness separately from operational conformity.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
const ROOT=path.resolve(path.dirname(url.fileURLToPath(import.meta.url)),'../..');
const data=JSON.parse(fs.readFileSync(path.join(ROOT,'src/data/academy/bahlIso21001ControlRegister.json'),'utf8'));
const catalog=JSON.parse(fs.readFileSync(path.join(ROOT,'src/data/university/buklodUniversityCatalog.json'),'utf8'));
const syllabus=JSON.parse(fs.readFileSync(path.join(ROOT,'src/data/academy/bahlQualityCurriculumFramework.json'),'utf8'));
const strict=process.argv.includes('--strict');
const today=new Date();
const errors=[];
const human=data.human_oversight_policy;
if(!human||human.per_learner_manual_approval!==false)
 errors.push('Academy owner oversight must not create per-learner manual approval.');
if(!human||human.independent_iso_audit_still_required!==true)
 errors.push('Real independent audit requirement must not be silently removed.');
const readSource=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const adminSource=readSource('src/app/admin/academy-research-review.tsx');
const learnerSource=readSource('src/app/academy/research.tsx');
const aiSource=readSource('supabase/functions/buklod-academy-research-ai-v2/index.ts');
const snapshotSql=readSource('supabase/migrations/20261124034000_buklod_academy_quality_overview_v1.sql');
if(/buklod_academy_review_research_v1|Verify & grant UC|p_approved/.test(adminSource))
 errors.push('Legacy manual academic approval returned to admin UI.');
if(!/buklod-academy-research-ai-v2/.test(learnerSource)||!/buklod_academy_my_research_v2/.test(learnerSource))
 errors.push('Missing automatic learner review and saved-review recovery.');
if(!aiSource.includes('SECOND independent adversarial evaluator')||!aiSource.includes('Math.min(total,secondary.score)'))
 errors.push('Missing advanced capstone independent automated cross-check.');
if(!snapshotSql.includes('public.is_system_admin()')||!snapshotSql.includes('revoke all on function'))
 errors.push('Founder quality metrics require restricted admin access.');

const seen=new Set();
const verified=[];
function error(s){errors.push(s)}
if(data.standard!=='ISO 21001:2025')error('Wrong standard');
if(data.quality_claim_allowed!==false||data.certification_claim_allowed!==false)error('Unsubstantiated ISO quality claim flag');
if(data.readiness_release_gate!=='FAIL_CLOSED_UNTIL_VERIFIED')error('Missing fail-closed release gate');
if(catalog.credentials.length!==53||syllabus.credential_profiles.length!==53)error('Catalog identity changed');
if(syllabus.catalog_version!==catalog.catalog_version)error('Catalog/version drift');
if(syllabus.source_modules.length!==14||syllabus.competency_matrix.length!==16)error('Source/outcome registry drift');
if(data.controls.length!==36)error('Missing expected ISO control groups');
for(const c of data.controls){
 if(seen.has(c.id))error('Duplicate control '+c.id);seen.add(c.id);
 if(!/^(4|5|6|7|8|9|10)$/.test(c.clause))error('Invalid clause group '+c.id);
 if(!c.accountable_role||!c.required_objective_evidence)error('No owner/evidence rule '+c.id);
 if(!Array.isArray(c.evidence_records))error('Bad evidence list '+c.id);
 if(c.implementation_status==='VERIFIED'){
  if(c.test_result!=='PASS'||!c.approved_by||!c.approved_at)error('Unapproved verified control '+c.id);
  if(!c.evidence_records.length)error('Missing evidence for '+c.id);
  if(!c.last_verified_at||!c.verified_until)error('Missing evidence currency '+c.id);
  else if(!Number.isFinite(Date.parse(c.verified_until))||Date.parse(c.verified_until)<today.getTime())error('Expired evidence '+c.id);
  if(c.evidence_records?.some(e=>{
   if(!e||typeof e!=='object')return true;
   const req=data.evidence_rules.required;
   return req.some(k=>!e[k])||e.result!=='ACCEPTED'
    ||!data.evidence_rules.accepted_kinds.includes(e.kind)
    ||!/^[a-f0-9]{64}$/.test(e.digest_sha256)
    ||!Number.isFinite(Date.parse(e.approved_at))
    ||!Number.isFinite(Date.parse(e.collected_at));
  }))error('Invalid accepted evidence record '+c.id);
  if(!errors.some(e=>e.includes(c.id)))verified.push(c.id);
 }else if(!['DESIGNED_NOT_VALIDATED','IN_PROGRESS','BLOCKED','NEEDS_RECHECK'].includes(c.implementation_status)){
  error('Unknown status '+c.id);
 }
}
const blockers=[
 ...['executive_policy_approval','legal_and_accreditation_representation_review','training_staff_appointments'].filter(k=>data[k]!=='APPROVED').map(k=>'Pending '+k),
 ...['internal_audit','management_review'].filter(k=>data[k]!=='PERFORMED_AND_APPROVED').map(k=>'Pending '+k),
 ...(data.scope_review==='APPROVED'?[]:['Scope not approved']),
 ...(data.standard_clause_by_clause_review==='COMPLETE'?[]:['Licensed standard clause-level gap audit pending'])
];
const ready=errors.length===0&&blockers.length===0&&verified.length===data.controls.length;
console.log(JSON.stringify({
 standard:data.standard,framework_version:data.version,
 total_controls:data.controls.length,operationally_verified:verified.length,
 structural_errors:errors,
 blocking_requirements:blockers,
 current_status:ready?'ALL_DOCUMENTED_CONTROLS_VERIFIED_FURTHER_EXTERNAL_AUDIT_STILL_REQUIRED':'NOT_READY',
 certification_claim_allowed:false
},null,2));
if(errors.length||strict&&!ready)process.exitCode=1;
