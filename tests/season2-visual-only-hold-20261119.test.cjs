'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('Season 2 visual staging release has no authority to activate rewards', () => {
  const release = JSON.parse(read('.buklod/releases/season2-conso-staging-20261119.json'));
  assert.equal(release.target, 'staging-user');
  assert.equal(release.environment, 'preview');
  assert.equal(release.expectedPackage, 'org.mzbministry.buklod.staging');
  assert.equal(release.expectedRuntime, '1.3.2');
  assert.equal(release.mode, 'preview_only_rewards_off');
  assert.equal(release.productionAuthorized, false);
  assert.equal(release.backendRewardsLive, false);
  assert.equal(release.seasonalResetLive, false);
  assert.equal(release.seasonOneUnchanged, true);
  assert.equal(release.season2RewardDbWritesAuthorized, false);
  assert.equal(release.requiresSeparateOwnerApprovalForRewards, true);
  assert.equal(release.rewardsHoldUntilManilaDay, '2026-12-06');
});

test('Every seasonal gameplay and award flag remains OFF before or after target date', () => {
  const source = read('src/lib/buklodSeason2CampaignR1.ts');
  for (const name of [
    'officialOpeningPublished', 'redemptionLive', 'missionAwardsLive',
    'chapterPublishingLive', 'cooperativeAwardsLive', 'inactivityDeductionsLive',
  ]) assert.match(source, new RegExp('\\b' + name + ':\\s*false\\b'),
    name + ' must stay false until separate signed activation');
  assert.match(source, /season-2-design-r1-off/);
});

test('Season 2 reward SQL is documentation only, never an applied migration', () => {
  const draft = read('docs/season2/sql/BUKLOD_S2_ISOLATED_REWARD_CORE_DRAFT_NOT_DEPLOY.sql');
  assert.match(draft, /NEVER AUTO-APPLY/);
  assert.match(draft, /create schema if not exists buklod_s2/);
  assert.match(draft, /enabled boolean not null default false/);
  assert.match(draft, /revoke all on schema buklod_s2 from public, anon, authenticated/);
  const migrationsDir=path.join(root, 'supabase/migrations');
  for (const item of fs.readdirSync(migrationsDir)) {
    if (!item.endsWith('.sql')) continue;
    const sql=fs.readFileSync(path.join(migrationsDir,item), 'utf8');
    assert.doesNotMatch(sql, /(?:create|alter)\\s+(?:schema|table|function)\\s+(?:if not exists\\s+)?buklod_s2\\b/i,
      'New Season 2 reward SQL must not be published in migration ' + item);
  }
});

test('Season 2 story preview has no client-side database reward grant', () => {
  const ui=read('src/components/points/BuklodSeasonJourneyPreview.tsx');
  assert.match(ui,/No BP, QMP, items or tokens awarded/);
  assert.match(ui,/no posting, enrollment, rewards or backend changes/);
  assert.doesNotMatch(ui,/\\.rpc\\s*\\(|service_role|grant_?tokens|credit_main_source|buy_cosmetic/i);
});
