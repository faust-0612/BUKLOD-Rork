import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const scope = JSON.parse(read('.buklod/scopes/nov16-complete-conso-staging132.json'));
const sql = read('supabase/migrations/20261115192034_buklod_bible_v4_review_transparency.sql');
const screen = read('src/components/bible/BuklodBibleQuizV4.tsx');
const eas = JSON.parse(read('eas.json'));

test('consolidated Bible review stays on staging-only Android runtime 1.3.2', () => {
  assert.match(scope.releaseTarget, /Android staging-user runtime 1\.3\.2 preview/);
  assert.match(scope.releaseMode, /staging-source-only-until-gates/);
  assert.equal(scope.otaPublished, false);
  assert.equal(scope.productionOtaPublished, false);
  assert.equal(scope.actualDeviceVerification, 'SKIPPED_BY_OWNER');
  assert.equal(eas.build['staging-user'].channel, 'staging-user');
  assert.equal(eas.build['staging-user'].environment, 'preview');
  assert.notEqual(eas.build['staging-user'].channel, eas.build.production.channel);
  for (const path of ['src/components/bible/BuklodBibleQuizV4.tsx',
    'supabase/migrations/20261115192034_buklod_bible_v4_review_transparency.sql',
    'tests/buklod-bible-v4-review-ota-20261116.test.mjs'])
    assert.ok(scope.allowedPaths.includes(path), path);
  for (const id of ['app-runtime','backend-security','quiz-classroom'])
    assert.ok(scope.lockedFeatureChanges.some(x => x.id === id), id);
});

test('supplementary learner answer review remains owned, submitted and read-only', () => {
  assert.match(sql, /security definer set search_path=''/i);
  assert.match(sql, /x\.user_id=actor/);
  assert.match(sql, /if a\.state='started'/);
  assert.match(sql, /submitted_answer/);
  assert.match(sql, /revoke all on function[\s\S]*from public,anon/i);
  assert.match(sql, /grant execute on function[\s\S]*to authenticated/i);
  assert.doesNotMatch(sql, /\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?private\.buklod_bible_v4_attempts/i);
  assert.match(screen, /get_my_buklod_bible_quiz_v4_review_details/);
});
