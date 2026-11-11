const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('KL reading quiz uses server-verified completion before optional ad', () => {
  const source = readFileSync('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx', 'utf8');
  const begin = source.indexOf('const submit = async');
  const end = source.indexOf('  return (', begin);
  const submitFlow = source.slice(begin, end);
  const request = submitFlow.indexOf("'kl_quiz_submit_v1'");
  const verified = submitFlow.indexOf('result.passed && result.completion?.completed === true');
  const awarded = submitFlow.indexOf('if (result.completion.new_completion === true)', verified);
  const ad = submitFlow.indexOf("showBuklodAdOpportunity('kl_chapter_success')", awarded);
  assert.ok(begin >= 0 && end > begin && request >= 0 &&
    verified > request && awarded > verified && ad > awarded,
    'the quiz ad must follow authenticated completion and a new reward');
  assert.match(source, /result\.completion\.new_completion === true/);
  assert.doesNotMatch(source, /claimBuklodRewardGroup\(|grant.*point/i);
});
