const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

test('KL reading quiz uses server-verified completion before optional ad', () => {
  const source = readFileSync('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx', 'utf8');
  const request = source.indexOf("'kl_quiz_submit_v1'");
  const verified = source.indexOf('result.passed && result.completion?.completed === true');
  const ad = source.indexOf("showBuklodAdOpportunity('kl_chapter_success')");
  assert.ok(request > 0 && verified > request && ad > verified);
  assert.match(source, /result\.completion\.new_completion === true/);
  assert.doesNotMatch(source, /claimBuklodRewardGroup\(|grant.*point/i);
});
