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

test('first-time server completion is required; replay and unverified reading cannot show', () => {
  const start=source.indexOf('const finishChapter = async');
  const end=source.indexOf('const syncViewport',start);
  assert.ok(start>0 && end>start);
  const code=source.slice(start,end);
  assert.match(code, /if \(!selected \|\| chapterCompletionInFlight\.current\) return/);
  assert.match(code, /if \(error\) \{ setRewardFeedback\(error\.message\); return/);
  assert.match(code, /if \(result\?\.new_completion === true\) await showBuklodAdOpportunity\('kl_chapter_success'\)/);
  assert.match(code, /finally \{\s*chapterCompletionInFlight\.current = false/);
  assert.ok(code.indexOf('setJourneyRefreshToken(') < code.indexOf("await showBuklodAdOpportunity('kl_chapter_success')"));
  assert.doesNotMatch(code, /claimBuklodRewardGroup|grantPoints|points_awarded\s*=/);
});

test('unified reader autoplay and Journey behavior remain present', () => {
  assert.match(source,/KlChapterAudio/);
  assert.match(source,/setJourneyRefreshToken/);
  assert.match(source,/kl_my_story_journey_v1/);
});
