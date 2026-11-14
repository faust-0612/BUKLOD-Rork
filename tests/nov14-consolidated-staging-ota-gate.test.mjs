import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  evaluateBuklodConsolidatedAcceptance as evaluate,
  REQUIRED_CHECK_IDS,
} from '../scripts/buklod-consolidated-staging-gate.mjs';

const acceptance = JSON.parse(readFileSync(new URL('../release/visual/buklod-consolidated-acceptance-20261114.json',import.meta.url),'utf8'));
const clone = () => structuredClone(acceptance);

test('Current incomplete consolidated candidate fails closed, never claiming old staging OTA as full completion', () => {
  assert.equal(acceptance.readyForRelease, false);
  assert.equal(acceptance.integrationStatus, 'draft_unreconciled');
  assert.equal(acceptance.previousStagingRelease.status, 'published_and_ci_verified');
  const failures=evaluate(acceptance);
  assert.ok(failures.length>=REQUIRED_CHECK_IDS.length);
  for (const id of REQUIRED_CHECK_IDS) assert.ok(failures.some(f=>f.includes(id)),id);
});

test('Cannot delete a missing feature check or bypass proof by changing only readyForRelease', () => {
  const doc=clone();
  doc.readyForRelease=true;
  doc.integrationStatus='merged_and_verified';
  doc.checks=doc.checks.filter(c=>c.id!=='health_center_consult_professional');
  doc.checks.forEach(c=>{c.status='verified';c.evidence=['Verified staging Android interaction and route evidence']});
  assert.ok(evaluate(doc).some(f=>f.includes('health_center_consult_professional')));
});

test('Wrong APK runtime or channel blocks even if feature evidence is filled out', () => {
  const doc=clone();
  doc.readyForRelease=true;doc.integrationStatus='merged_and_verified';
  doc.checks.forEach(c=>{c.status='verified';c.evidence=['Verified exact-source native Android staging test']});
  assert.deepEqual(evaluate(doc),[]);
  doc.runtimeVersion='1.3.6';
  assert.ok(evaluate(doc).some(f=>f.includes('release identity')));
});

test('Duplicate, absent, empty or unverified evidence can never satisfy release contract', () => {
  const doc=clone();doc.readyForRelease=true;doc.integrationStatus='merged_and_verified';
  doc.checks.forEach(c=>{c.status='verified';c.evidence=['Verified Android staging evidence']});
  doc.checks[0].evidence=[];
  assert.ok(evaluate(doc).some(f=>f.includes(doc.checks[0].id)));
  doc.checks[0].evidence=['Verified Android staging evidence'];
  doc.checks.push({...doc.checks[0]});
  assert.ok(evaluate(doc).some(f=>f.includes('duplicate')));
});

test('Publisher contains a mandatory consolidated gate BEFORE exact once Expo update', () => {
  const workflow=readFileSync(new URL('../.github/workflows/buklod-visual-staging-ota-20261113.yml',import.meta.url),'utf8');
  const preflight=workflow.indexOf('Require complete owner-approved consolidated feature acceptance');
  const publish=workflow.indexOf('Exactly-once owner staging OTA; no APK, web or production');
  assert.ok(preflight>0 && publish>preflight);
  assert.match(workflow,/node scripts\/buklod-consolidated-staging-gate\.mjs/);
});
