import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const screen = read('src/app/profile/buklod-health.tsx');
const guide = read('src/components/health/BuklodImciTagalogGuide.tsx');
const library = read('src/lib/buklodImciTagalog.ts');

const output = ts.transpileModule(library, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  reportDiagnostics: true,
});
assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, 'IMCI TypeScript must transpile cleanly');
const mod = { exports: {} };
runInNewContext(output.outputText, { module: mod, exports: mod.exports });
const { getImciQuestions, getImciOutcome, IMCI_AGE_OPTIONS } = mod.exports;

test('IMCI Tagalog guide uses separate infant, under-five and older age pathways', () => {
  assert.equal(IMCI_AGE_OPTIONS.length, 3);
  assert.match(library, /Wala pang 2 buwan/);
  assert.match(library, /2 buwan–wala pang 5 taon/);
  assert.match(library, /5 taon pataas/);
  assert.ok(getImciQuestions('young_infant').some(q => q.id === 'infant_feed'));
  assert.ok(getImciQuestions('child').some(q => q.id === 'child_drink'));
  assert.ok(getImciQuestions('older').some(q => q.id === 'older_response'));
  assert.match(guide, /hindi under-five IMCI/);
});

test('Yes or unsure on a danger sign interrupts routine screening and escalates immediately', () => {
  for (const age of ['young_infant', 'child', 'older']) {
    const danger = getImciQuestions(age).find(q => q.level === 'danger');
    assert.ok(danger, age);
    assert.equal(getImciOutcome(age, { [danger.id]: 'yes' }), 'emergency');
    assert.equal(getImciOutcome(age, { [danger.id]: 'unsure' }), 'emergency');
    assert.equal(getImciOutcome(age, { [danger.id]: 'no' }), 'review');
  }
  assert.equal(getImciOutcome('young_infant', { infant_temp: 'yes' }), 'emergency');
  assert.equal(getImciOutcome('child', { child_seizure: 'unsure' }), 'emergency');
  assert.match(guide, /Huwag maghintay sa AI/);
  assert.match(guide, /tel:911/);
});

test('Non-emergency concerning symptoms prompt clinician review, not diagnosis or self-prescribing', () => {
  assert.equal(getImciOutcome('child', { child_blood: 'yes' }), 'consult');
  assert.equal(getImciOutcome('young_infant', { infant_navel: 'unsure' }), 'consult');
  assert.equal(getImciOutcome('child', {}), 'review');
  assert.match(guide, /hindi ito diagnosis, reseta/);
  assert.match(guide, /hindi patunay na walang sakit/);
  assert.match(guide, /Mga isasabi sa health worker/);
});

test('One-question-at-a-time guided answers are volatile and never sent to the external center', () => {
  for (const marker of ['setAnswers', 'setIndex', 'Tanong {index + 1}', 'Hindi sigurado', 'Bumalik', 'Susunod', 'Simulang muli']) {
    assert.ok(guide.includes(marker), marker);
  }
  assert.doesNotMatch(guide, /AsyncStorage|localStorage|supabase|fetch\(/);
  assert.doesNotMatch(library, /AsyncStorage|localStorage|supabase|fetch\(/);
  assert.match(library, /PHL-MN-62-01-OPERATIONALGUIDANCE-2015/);
});

test('Main Health Center foregrounds IMCI and blocks consultations and ads on urgent child signs', () => {
  assert.match(screen, /<BuklodImciTagalogGuide onUrgencyChange=\{setImciUrgent\}/);
  assert.ok(screen.indexOf('<BuklodImciTagalogGuide') < screen.indexOf('Anong tulong ang kailangan mo?'));
  assert.match(screen, /!imciUrgent && BUKLOD_HEALTH_CONSULTATION_READY/);
  assert.match(screen, /urgency === 'none' && !imciUrgent/);
  assert.match(screen, /!BUKLOD_HEALTH_CONSULTATION_READY/);
  assert.match(screen, /launchBuklodHealthCenter/);
  assert.match(screen, /Full Health Center/);
  assert.match(screen, /Online Consultation/);
  assert.match(screen, /CONCERN_HELP\[concern\]/);
});
