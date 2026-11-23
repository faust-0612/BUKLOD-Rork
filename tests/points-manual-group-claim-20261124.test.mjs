import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync('src/components/points/BuklodPointsRewardsScreen.tsx', 'utf8');
const rewards = readFileSync('src/lib/buklodRewards.ts', 'utf8');
const adBridge = readFileSync('src/lib/buklodAdOpportunities.ts', 'utf8');

function getClaimHandler() {
  const startMarker = 'const claimGroup = useCallback(async (group: BuklodClaimGroup) => {';
  const endMarker = '}, [accountId, characterEvents, claimSound, load, motionEnabled, soundOn]);';
  const start = screen.indexOf(startMarker);
  const end = screen.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, 'claim group handler must be present');
  const body = screen.slice(start + startMarker.length, end);
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  // Execute the actual async handler body against controlled dependency stubs.
  return new AsyncFunction('group', 'env', 'with (env) {' + body + '}');
}

function harness({ claim, ad } = {}) {
  const state = {
    groups: [
      { group_key: 'posting', group_label: 'Posting', total_points: 5, event_count: 1 },
      { group_key: 'engagement', group_label: 'Comments & Reactions', total_points: 7, event_count: 3 },
    ],
    dashboard: { lifetime_points: 100, available_points: 80, pending_claimable_points: 12 },
    error: null, technical: null, busy: null, success: null, celebratory: false,
    claimedCalls: [], adCalls: 0, refreshCalls: 0, warmed: 0, events: [],
  };
  const deferredClaim = claim ?? (async () => ({
    claimed_points: 5, lifetime_points: 105, available_points: 85,
    rank_up: true, rank_name: 'Circle Starter IV',
  }));
  const env = {
    claimInFlightRef: { current: false }, accountId: 'test-member',
    pointsViewCache: new Map([['test-member', { loadedAt: 1 }]]),
    Haptics: {
      ImpactFeedbackStyle: { Light: 1 }, NotificationFeedbackType: { Success: 1, Error: 2 },
      impactAsync: async () => undefined, notificationAsync: async () => undefined,
    },
    claimBuklodRewardGroup: async (groupKey) => {
      state.claimedCalls.push(groupKey);
      return deferredClaim(groupKey);
    },
    setClaimingGroup: (value) => { state.busy = value; },
    setClaimError: (value) => { state.error = value; },
    setClaimTechnicalError: (value) => { state.technical = value; },
    setDashboard: (updater) => {
      state.dashboard = typeof updater === 'function' ? updater(state.dashboard) : updater;
    },
    setClaimGroups: (updater) => {
      state.groups = typeof updater === 'function' ? updater(state.groups) : updater;
    },
    setLastSuccess: (value) => { state.success = value; },
    setCelebrationActive: (value) => { state.celebratory = value; },
    soundOn: false, claimSound: {}, playAudio: () => {},
    motionEnabled: true, characterEvents: { emit: (event) => state.events.push(event) },
    CharacterEventType: { MILESTONE_REACHED: 'rank', POINTS_CLAIMED: 'claim' },
    load: async () => { state.refreshCalls += 1; },
    showBuklodAdOpportunity: async (event) => {
      state.adCalls += 1;
      return ad ? ad(event) : false;
    },
    warmBuklodAdOpportunity: () => { state.warmed += 1; },
    normalizeErrorMessage: (e) => String(e?.message ?? e),
    friendlyClaimError: () => 'Claim could not finish. Refresh and try again.',
  };
  return { state, env, group: state.groups[0] };
}

test('only the selected group is credited; celebration and ads follow settlement, not precede it', async () => {
  const order = [];
  const t = harness({
    claim: async () => { order.push('settled'); return {
      claimed_points: 5, lifetime_points: 105, available_points: 85,
      rank_up: true, rank_name: 'Circle Starter IV',
    }; },
    ad: async () => { order.push('ad'); return false; },
  });
  const handler = getClaimHandler();
  await handler(t.group, t.env);
  assert.deepEqual(order, ['settled', 'ad']);
  assert.deepEqual(t.state.claimedCalls, ['posting']);
  assert.deepEqual(t.state.groups.map((g) => g.group_key), ['engagement']);
  assert.equal(t.state.dashboard.lifetime_points, 105);
  assert.equal(t.state.dashboard.available_points, 85);
  assert.equal(t.state.dashboard.pending_claimable_points, 7);
  assert.equal(t.state.success.points, 5);
  assert.equal(t.state.events.filter(e => e.type === 'rank').length, 1);
  assert.equal(t.state.adCalls, 1);
  assert.equal(t.state.error, null);
  assert.equal(t.state.busy, null);
});

test('rapid duplicate taps cannot start a second transaction or second ad', async () => {
  let settle;
  const t = harness({ claim: () => new Promise(resolve => { settle = resolve; }) });
  const handler = getClaimHandler();
  const first = handler(t.group, t.env);
  await handler(t.group, t.env);
  assert.deepEqual(t.state.claimedCalls, ['posting']);
  assert.equal(t.state.adCalls, 0);
  settle({ claimed_points: 5, lifetime_points: 105, available_points: 85, rank_up: false });
  await first;
  assert.equal(t.state.adCalls, 1);
  assert.equal(t.env.claimInFlightRef.current, false);
});

test('no-fill or rejected ad does not undo verified claim', async () => {
  const t = harness({ ad: () => Promise.reject(new Error('no fill')) });
  await getClaimHandler()(t.group, t.env);
  assert.equal(t.state.success.points, 5);
  assert.equal(t.state.error, null);
  assert.deepEqual(t.state.groups.map(g => g.group_key), ['engagement']);
  assert.equal(t.state.adCalls, 1);
});

test('ambiguous network failure never auto-retries a mutation or shows an ad', async () => {
  const t = harness({ claim: async () => { throw new Error('timeout'); } });
  await getClaimHandler()(t.group, t.env);
  assert.equal(t.state.claimedCalls.length, 1);
  assert.equal(t.state.adCalls, 0);
  assert.equal(t.state.groups.length, 2);
  assert.equal(t.state.success, null);
  assert.match(t.state.error, /Refresh and try again/);
  assert.equal(t.state.refreshCalls, 1);
  assert.equal(t.env.claimInFlightRef.current, false);
});

test('already-claimed empty response is a refresh, not a new reward or ad', async () => {
  const t = harness({ claim: async () => ({
    claimed_points: 0, lifetime_points: 100, available_points: 80,
    rank_up: false,
  }) });
  await getClaimHandler()(t.group, t.env);
  assert.equal(t.state.adCalls, 0);
  assert.equal(t.state.success, null);
  assert.match(t.state.error, /already been claimed/);
  assert.equal(t.state.refreshCalls, 1);
});

test('Claim All retired from frontend and compatibility API; server group RPC remains authoritative', () => {
  assert.doesNotMatch(screen, /claimAll|CLAIM ALL|__buklod_claim_all_eligible__/i);
  assert.doesNotMatch(rewards, /claim_all_my_buklod_reward_events|__buklod_claim_all_eligible__/);
  assert.match(screen, /onClaim=\{\(\) => void claimGroup\(group\)\}/);
  assert.match(screen, /claimDisabled=\{claimingGroup !== null\}/);
  assert.match(rewards, /'claim_my_buklod_reward_group_v1'/);
  assert.match(adBridge, /maybeShowBuklodInterstitial/);
  assert.match(adBridge, /existing global controller enforces/i);
});
