import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const screen = read('src/app/profile/buklod-health.tsx');
const guide = read('src/components/health/BuklodImciTagalogGuide.tsx');
const library = read('src/lib/buklodImciTagalog.ts');
const ajaGuide = read('src/components/health/BuklodAjaTagalogGuide.tsx');
const ajaLibrary = read('src/lib/buklodAjaTagalog.ts');

const js = stripTypeScriptTypes(library).replace(/^export /gm, '');
const { getImciQuestions, getImciOutcome, IMCI_AGE_OPTIONS } =
  runInNewContext(js + '\n({ getImciQuestions, getImciOutcome, IMCI_AGE_OPTIONS })', {});

test('IMCI Tagalog guide uses separate infant, under-five and older age pathways', () => {
  assert.equal(IMCI_AGE_OPTIONS.length, 3);
  assert.match(library, /Wala pang 2 buwan/);
  assert.match(library, /2 buwan–wala pang 5 taon/);
  assert.match(library, /5 taon pataas/);
  assert.ok(getImciQuestions('young_infant').some(q => q.id === 'infant_feed'));
  assert.ok(getImciQuestions('child').some(q => q.id === 'child_drink'));
  assert.ok(getImciQuestions('older').some(q => q.id === 'older_response'));
  assert.match(guide, /Ang IMCI na ito ay para sa wala pang 5 taong gulang/);
  assert.match(guide, /const \[hasAge, setHasAge\] = useState\(false\)/);
  assert.match(guide, /setHasAge\(true\)/);
  assert.match(guide, /\{hasAge \? \(<>/);
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
  assert.match(screen, /!imciUrgent && !ajaUrgent && BUKLOD_HEALTH_CONSULTATION_READY/);
  assert.match(screen, /urgency === 'none' && !imciUrgent && !ajaUrgent/);
  assert.match(screen, /!BUKLOD_HEALTH_CONSULTATION_READY/);
  assert.match(screen, /launchBuklodHealthCenter/);
  assert.match(screen, /Full Health Center/);
  assert.match(screen, /Online Consultation/);
  assert.match(screen, /CONCERN_HELP\[concern\]/);
});

test('Expanded in-app IMCI covers infant and under-five symptoms, nutrition and follow-up', () => {
  const infant = getImciQuestions('young_infant');
  const child = getImciQuestions('child');
  assert.ok(infant.length >= 18);
  assert.ok(child.length >= 27);
  for (const id of ['infant_umbilical_discharge','infant_skin_pustules','infant_urine','infant_feeding_support','infant_postnatal']) assert.ok(infant.some(q => q.id === id), id);
  for (const id of ['child_long_cough','child_long_diarrhea','child_rash_measles','child_both_feet_swollen','child_pallor','child_immunization_gap','child_followup']) assert.ok(child.some(q => q.id === id), id);
  assert.equal(getImciOutcome('young_infant', { infant_urine: 'unsure' }), 'consult');
  assert.equal(getImciOutcome('child', { child_long_diarrhea: 'yes' }), 'consult');
  assert.match(guide, /delete next\[id\]/);
});

test('In-app AJA has ages 10–19, consent, HEEADSSS, volatile answers and immediate safety guard', () => {
  const src = stripTypeScriptTypes(ajaLibrary).replace(/^export /gm, '');
  const { AJA_BANDS, AJA_QUESTIONS, ajaDisposition, ajaHandoffTopics } =
    runInNewContext(src + '\n({ AJA_BANDS, AJA_QUESTIONS, ajaDisposition, ajaHandoffTopics })', {});
  assert.equal(AJA_BANDS.length, 2);
  assert.ok(AJA_QUESTIONS.length >= 20);
  for (const s of ['Tahanan','Pag-aaral','Pagkain','Substances','Pagdadalaga at pagbibinata','Emosyon','Kaligtasan']) assert.ok(AJA_QUESTIONS.some(q => q.section === s),s);
  assert.equal(ajaDisposition({ imminent_selfharm: 'unsure' }), 'emergency');
  assert.equal(ajaDisposition({ imminent_violence: 'yes' }), 'emergency');
  assert.equal(ajaDisposition({}), 'consult');
  assert.equal(ajaDisposition({ consciousness: 'no', imminent_selfharm: 'no', imminent_violence: 'no' }), 'review');
  assert.ok(Array.from(ajaHandoffTopics({ low_mood: 'yes' })).includes('Emosyon'));
  assert.match(ajaGuide, /useState<AjaBand \| null>\(null\)/);
  assert.match(ajaGuide, /setConsent/);
  assert.match(ajaGuide, /'tel:911'/);
  assert.match(ajaGuide, /delete next\[id\]/);
  assert.doesNotMatch(ajaGuide + ajaLibrary, /AsyncStorage|localStorage|supabase|fetch\(/);
  assert.match(screen, /<BuklodAjaTagalogGuide onUrgencyChange=\{setAjaUrgent\}/);
  assert.match(screen, /!imciUrgent && !ajaUrgent/);
});
