const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = (path) => readFileSync(join(process.cwd(), path), 'utf8');

test('ad opportunities are server-success breaks, never required to claim or submit', () => {
  const points = source('src/components/points/BuklodPointsRewardsScreen.tsx');
  const devotional = source('src/app/reflection/[id].tsx');
  const learning = source('src/components/LearningQuestionResponse.tsx');
  const chapter = source('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx');

  assert.ok(points.indexOf("await claimBuklodRewardEvent('__buklod_claim_all_eligible__')") < points.indexOf("await showBuklodAdOpportunity('points_claim_success')"));
  assert.ok(devotional.indexOf("'complete_my_devotional_v2'") < devotional.indexOf("await showBuklodAdOpportunity('devotional_reflection_success')"));
  assert.ok(learning.indexOf("'complete_my_formation_lesson_v2'") < learning.indexOf("await showBuklodAdOpportunity('formation_lesson_success')"));
  assert.match(devotional, /BuklodSubmissionAdSlot placementId="devotional_reflection_before_submit"/);
  assert.match(learning, /BuklodSubmissionAdSlot placementId="formation_lesson_before_submit"/);
  assert.ok(chapter.indexOf("'kl_quiz_submit_v1'") < chapter.indexOf("showBuklodAdOpportunity('kl_chapter_success')"));
});

test('rewards are not transferable points and ad unavailability never blocks a completion', () => {
  const bridge = source('src/lib/buklodAdOpportunities.ts');
  assert.match(bridge, /Platform.OS !== 'android'/);
  assert.match(bridge, /catch\s*\{\s*return false;/);
  assert.doesNotMatch(bridge, /claimBuklodReward|points_cash|awardPoints|insert\(/);
  assert.match(source('src/lib/buklodGlobalAdController.ts'), /INTERSTITIAL_MIN_EVENT_COUNT/);
  assert.match(source('src/lib/buklodGlobalAdController.ts'), /fullScreenCadencePersistenceFailed/);
  assert.match(source('src/components/points/BuklodPointsRewardsScreen.tsx'), /BuklodAdLightRewardCard/);
});
