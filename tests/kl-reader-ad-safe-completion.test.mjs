import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contract checks for the canonical KL reader. The native SDK's real creative
// callback still requires an Android device and AdMob test inventory.
const source = readFileSync('src/components/kabihasnang-ligaw/KlReaderScreen.tsx', 'utf8');

test('KL ad is prewarmed only when a released chapter is readable and online', () => {
  assert.match(source, /if \(selected && serverState === 'readable' && online\)/);
  assert.match(source, /warmBuklodAdOpportunity\('kl_chapter_success'\)/);
});

test('first-time server quiz completion is required; replay and unverified reading cannot show ads', () => {
  const source = readFileSync('src/components/kabihasnang-ligaw/KlReadingQuiz.tsx', 'utf8');
  assert.match(source, /'kl_quiz_begin_v1'/);
  assert.match(source, /'kl_quiz_submit_v1'/);
  assert.match(source, /result\.passed && result\.completion\?\.completed === true/);
  assert.match(source, /result\.completion\.new_completion === true/);
  assert.match(source, /showBuklodAdOpportunity\('kl_chapter_success'\)/);
  assert.doesNotMatch(source, /claimBuklodRewardGroup|grantPoints|points_awarded\s*=/);
  assert.match(readFileSync('src/components/kabihasnang-ligaw/KlReaderScreen.tsx','utf8'), /<KlReadingQuiz/);
});

test('unified reader autoplay and Journey behavior remain present', () => {
  assert.match(source,/KlChapterAudio/);
  assert.match(source,/setJourneyRefreshToken/);
  assert.match(source,/kl_my_story_journey_v1/);
});
