import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const learn = source('src/app/(tabs)/learn.tsx');
const journey = source('src/components/formation/FormationJourneySection.tsx');
const catalog = source('src/components/formation/FormationAdvancedStageCatalog.tsx');
const copy = source('src/lib/formationCopy.ts');
const scopedPortal = source('src/app/scope/buklod-lesson/index.tsx');

test('all seven stage labels come from one canonical Formation vocabulary', () => {
  for (let stage = 101; stage <= 107; stage++) {
    assert.match(copy, new RegExp(`\\b${stage}: '`));
  }
  assert.match(learn, /STAGE_SUBTITLES\[stage\.stage_code\] \?\? stage\.stage_title/);
  assert.match(journey, /STAGE_PHASES\[stage\.stage_code\] \?\? stage\.title_fil/);
});

test('disabled or failed V2 lookup never silently becomes an unlocked V2 card', () => {
  assert.match(learn, /!formationJourney\.engineAvailable \|\| formationJourney\.engineEnabled/);
  assert.match(learn, /missing access data is not an unlock/);
  assert.match(journey, /cardStatus === 'HISTORICALLY_LOCKED'/);
  assert.match(journey, /isFormationStageLocked\?\.\(stage\.stage_code\) === true/);
});

test('advanced stage cards open catalog rather than have a dead click', () => {
  assert.match(journey, /setCatalogRequest\(\(previous\) =>/);
  assert.match(journey, /openRequest=\{catalogRequest\?\.stageCode === stage\.stage_code/);
  assert.match(catalog, /openRequest > handledOpenRequest\.current/);
  assert.match(catalog, /setDrawerOpen\(true\)/);
  assert.doesNotMatch(journey, /curriculum_required_count === 0/);
});

test('advanced lessons are fail-closed while access permission is loading', () => {
  assert.match(catalog, /stageLocked \|\| !accessResolved \|\| !access\?\.allowed/);
  assert.match(catalog, /Checking lesson access/);
  assert.match(catalog, /accessResolved && \(!access \|\| !access\.allowed\)/);
});

test('formation stage card is not nested inside another touchable/card', () => {
  assert.match(journey, /<View key=\{stage\.stage_code\} style=\{styles\.stageWrap\}>/);
  assert.match(journey, /<\/Pressable>\s+\{\(stage\.stage_code === 106/);
  assert.doesNotMatch(catalog, /<Card>/);
  assert.doesNotMatch(journey, /<SectionTitle>/);
  assert.doesNotMatch(catalog, /Mentoring lessons for this stage are released periodically/);
});

test('scoped Formation still delegates to the same learning content', () => {
  assert.match(scopedPortal, /<BuklodLearningContent variant="embedded" \/>/);
  assert.match(learn, /variant\?: 'screen' \| 'embedded'/);
});
