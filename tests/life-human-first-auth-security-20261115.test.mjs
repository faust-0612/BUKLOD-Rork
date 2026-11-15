import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = name => readFileSync(name, 'utf8');

test('LIFE remains human-first and includes twelve distinct practical concerns', () => {
  const guide = source('src/lib/buklodLifeGuide.ts');
  const keys = [...guide.matchAll(/\{ key:'([^']+)', label:/g)].map(x => x[1]);
  assert.equal(new Set(keys).size, 12);
  const home = source('src/app/life/index.tsx');
  assert.match(home, /BUKLOD_LIFE_CONCERNS\.map/);
  assert.match(home, /showFaithContent &&/);
  const tabs = source('src/components/BuklodLifeTabs.tsx');
  assert.match(tabs, /share:\s*'Ibahagi'/);
  assert.match(tabs, /share:\s*'Share'/);
  assert.doesNotMatch(tabs, /Ibahagi si Jesus|Share Jesus/);
  const support = source('src/app/life/support.tsx');
  assert.match(support, /topic\.practical\[lang\]/);
  assert.match(support, /setRequested\(true\)/);
  assert.match(support, /activeScope\?\.show_faith_content/);
});

test('LIFE respects personal faith opt-out without suppressing practical support', () => {
  const topic = source('src/app/life/topic.tsx');
  assert.match(topic, /!showFaithContent && \(topic === 'jesus' \|\| topic === 'help' \|\| topic === 'questions'\)/);
  assert.match(topic, /<Redirect href="\/life" \/>/);
  assert.match(topic, /showFaithContent && stage >= 1/);
  const guide = source('src/app/life/guide.tsx');
  assert.match(guide, /<BuklodFaithRouteBoundary>/);
  assert.match(guide, /setAllowed\(true\)/);
});

test('auth registration routes only opted-in referral recipients to LIFE welcome', () => {
  const register = source('src/app/(auth)/register.tsx');
  assert.match(register, /params\.life === '1'/);
  assert.match(register, /navigateAfterRegistration\(\)/);
  assert.match(register, /router\.replace\('\/\(tabs\)\/buklod'\)/);
  assert.match(register, /pathname: '\/life\/invite'/);
  assert.doesNotMatch(source('src/app/life/invite.tsx'), /markMyBuklodLifeStage/);
});

test('LIFE navigation never infers faith milestones or reports spiritual status', () => {
  const topic = source('src/app/life/topic.tsx');
  assert.doesNotMatch(topic, /markMyBuklodLifeStage/);
  assert.match(topic, /saveBuklodLifePrivateProgress/);
  const progress = source('src/lib/buklodLifePrivateProgress.ts');
  assert.match(progress, /expo-secure-store/);
  assert.doesNotMatch(progress, /async-storage/);
  assert.match(progress, /deleteItemAsync/);
  const sql = source('supabase/migrations/20261115125000_buklod_life_no_inferred_milestones.sql');
  assert.match(sql, /Backwards-compatible no-op/);
  assert.doesNotMatch(sql, /insert into public\.notifications/i);
  assert.match(sql, /recent_activity', '\[\]'::jsonb/);
  const impact = source('src/app/life/impact.tsx');
  assert.doesNotMatch(impact, /faith_journeys_started/);
});

test('LIFE includes authored question and scripture references', () => {
  const scriptures = source('src/lib/buklodLifeScripture.ts');
  const core = scriptures.match(/BUKLOD_LIFE_GOSPEL_REFERENCES = \[([\s\S]*?)\] as const;/);
  assert.ok(core);
  assert.equal((core[1].match(/reference:/g) ?? []).length, 6);
  assert.match(scriptures, /1 Corinthians 15:3–8, 14/);
  const content = source('src/lib/buklodLifeContent.ts');
  assert.match(content, /Bakit hindi sapat ang pagiging mabuting tao/);
  assert.match(content, /Why do Christians believe Jesus rose from the dead/);
  const screen = source('src/app/life/topic.tsx');
  assert.match(screen, /BUKLOD_LIFE_GOSPEL_REFERENCES\[index\]/);
  assert.match(screen, /BUKLOD_LIFE_QUESTION_REFERENCES\[/);
});

test('Private LIFE continuation restores an explicit saved step and selected question', () => {
  const progress = source('src/lib/buklodLifePrivateProgress.ts');
  const impact = source('src/app/life/impact.tsx');
  const topic = source('src/app/life/topic.tsx');
  assert.match(progress, /questionIndex\?: number/);
  assert.match(progress, /Number\.isInteger\(input\.questionIndex\)/);
  assert.match(progress, /input\.topic !== 'questions'/);
  assert.match(progress, /p\.topic === 'questions'/);
  assert.match(impact, /resume: saved\.step/);
  assert.match(impact, /questionIndex: String\(saved\.questionIndex\)/);
  assert.match(topic, /params\.resume === 'next-steps'/);
  assert.match(topic, /setGospelYesOpen\(false\)/);
  assert.match(topic, /params\.questionIndex !== undefined/);
  assert.match(topic, /step: 'questions', questionIndex: selectedQuestionIndex/);
  assert.match(topic, /'I-save ang tanong na ito'/);
});
