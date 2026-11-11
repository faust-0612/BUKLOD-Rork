import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const read = path => readFileSync(path, 'utf8');
const source = read('src/lib/buklodCommunityCommentAdCadence.ts');
const runnable = stripTypeScriptTypes(source, { mode: 'strip' })
  .replace(/^export\s+/gm, '');
const cadence = vm.runInNewContext(
  runnable + '\n({ recordConfirmedCommunityComment, takePendingCommunityCommentAdBreak })',
  { Map, Date, String },
);

test('confirmed Community comments stay unbounded; ad milestones are sparse', () => {
  const day = new Date('2026-11-10T18:00:00Z');
  for (let count = 1; count <= 36; count++) {
    const result = cadence.recordConfirmedCommunityComment('account-a', day);
    assert.equal(result.successful, count);
    assert.equal(result.shouldWarm, count >= 5 && (count - 5) % 5 === 0);
    assert.equal(cadence.takePendingCommunityCommentAdBreak('account-a', day),
      count >= 6 && (count - 6) % 5 === 0);
    assert.equal(cadence.takePendingCommunityCommentAdBreak('account-a', day), false);
  }
});

test('comment break pending state is isolated by account and Manila day', () => {
  const first = new Date('2026-11-10T18:00:00Z');
  for (let index = 0; index < 6; index++) {
    cadence.recordConfirmedCommunityComment('account-b', first);
  }
  assert.equal(cadence.takePendingCommunityCommentAdBreak('account-c', first), false);
  const next = new Date('2026-11-11T16:00:00Z');
  assert.equal(cadence.takePendingCommunityCommentAdBreak('account-b', next), false);
  assert.equal(cadence.recordConfirmedCommunityComment('account-b', next).successful, 1);
  assert.equal(cadence.takePendingCommunityCommentAdBreak(''), false);
});

test('Public and scoped Wall ads mount measurable slots before list viewability', () => {
  for (const path of ['src/app/(tabs)/buklod.tsx',
                      'src/components/BuklodExclusiveScopeCommunity.tsx']) {
    const wall = read(path);
    assert.match(wall, /buildCommunityFeedWithInlineAds/);
    assert.match(wall, /<BuklodCommunityInlineAd/);
    assert.doesNotMatch(wall, /active=\{isAdActive\(item\.id\)\}/);
  }
  const native = read('src/components/BuklodCommunityInlineAd.android.tsx');
  assert.match(native, /reserveBuklodPassiveAdRequest\(placementId, requestKey\)/);
  assert.match(native, /eligible \|\| hasLoadedCreative/);
  assert.match(native, /currentlyVisible/);
  const hook = read('src/hooks/useBuklodCommunityAdViewability.ts');
  assert.match(hook, /minimumViewTime: 400/);
});

test('comment interstitials remain nonblocking and only after confirmed RPC success', () => {
  const wall = read('src/app/(tabs)/buklod.tsx');
  const scope = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  const detail = read('src/app/post/[id].tsx');
  const ads = read('src/lib/buklodAdOpportunities.ts');
  assert.match(ads, /community_comment_overage/);
  assert.ok(wall.indexOf('if(error)throw error;') <
            wall.indexOf('recordConfirmedCommunityComment(authorId)'));
  assert.ok(scope.indexOf('if (error) throw error;') <
            scope.indexOf('recordConfirmedCommunityComment(String(user.id))'));
  assert.ok(detail.indexOf('if(error)') <
            detail.indexOf('recordConfirmedCommunityComment(String(user.id))'));
  for (const s of [wall, scope]) {
    assert.match(s, /takePendingCommunityCommentAdBreak\(adAccount\)/);
    assert.match(s, /showBuklodAdOpportunity\('community_comment_overage'\)/);
  }
  assert.doesNotMatch(source, /supabase|points_ledger|rewardedAd/);
});

