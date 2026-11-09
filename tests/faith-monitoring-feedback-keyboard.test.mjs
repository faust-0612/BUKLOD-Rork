import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout as wait } from 'node:timers/promises';
import { createFaithMonitoringMemberSearch } from '../src/lib/buklodFaithMonitoringMemberSearch.ts';

const source = readFileSync('src/components/BuklodScopeFaithMonitoringAdminFeedbackCard.tsx', 'utf8');
const report = readFileSync('src/app/scope/faith-monitoring/report.tsx', 'utf8');

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test('Faith feedback member lookup debounces rapid typing into one request', async () => {
  const queries = [];
  const results = [];
  const controller = createFaithMonitoringMemberSearch(async (query) => {
    queries.push(query);
    return [query];
  }, (rows) => results.push(rows), undefined, 10);

  controller.update('S');
  controller.update('So');
  controller.update('Sof');
  await wait(40);

  assert.deepEqual(queries, ['Sof']);
  assert.deepEqual(results, [['Sof']]);
  controller.dispose();
});

test('Late results cannot overwrite a newer scoped member search', async () => {
  const a = deferred();
  const b = deferred();
  const results = [];
  const controller = createFaithMonitoringMemberSearch(
    (query) => query === 'first' ? a.promise : b.promise,
    (rows) => results.push(rows), undefined, 0
  );

  controller.update('first');
  await wait(8);
  controller.update('second');
  await wait(8);
  b.resolve(['newest']);
  await wait(0);
  a.resolve(['stale']);
  await wait(0);

  assert.deepEqual(results, [['newest']]);
  controller.dispose();
});

test('Dispose cancels both scheduled and in-flight lookups', async () => {
  const slow = deferred();
  const results = [];
  let calls = 0;
  const controller = createFaithMonitoringMemberSearch(
    () => { calls += 1; return slow.promise; },
    (rows) => results.push(rows), undefined, 1
  );
  controller.update('scope A');
  await wait(8);
  controller.dispose();
  slow.resolve(['wrong scope']);
  await wait(0);
  assert.equal(calls, 1);
  assert.deepEqual(results, []);

  const scheduled = createFaithMonitoringMemberSearch(
    async () => { calls += 1; return []; },
    (rows) => results.push(rows), undefined, 30
  );
  scheduled.update('scope B');
  scheduled.dispose();
  await wait(40);
  assert.equal(calls, 1);
});

test('Member typing cannot reload/unmount the feedback form', () => {
  const fetchStart = source.indexOf('const load = useCallback(async () =>');
  const fetchEnd = source.indexOf('useFocusEffect(', fetchStart);
  const fetchBlock = source.slice(fetchStart, fetchEnd);
  assert.ok(fetchStart > 0 && fetchEnd > fetchStart);
  assert.match(fetchBlock, /fetchScopeFaithMonitoringFeedbackAdminList\(scopeId\)/);
  assert.doesNotMatch(fetchBlock, /fetchScopeMembers|memberQuery/);
  assert.match(fetchBlock, /\}, \[scopeId\]\);/);

  // A background refresh may show a spinner but must not detach focused inputs.
  assert.match(source, /\{loading \? <ActivityIndicator[^\n]+: null\}/);
  assert.match(source, /\{initiallyLoaded \? \(/);
  assert.match(source, /search\.update\(memberQuery\)/);
  assert.match(source, /return \(\) => search\.dispose\(\)/);
  assert.match(source, /feedbackRequestVersion\.current \+= 1/);
  assert.match(source, /maxLength=\{600\}/);
  assert.match(source, /upsertScopeFaithMonitoringFeedback\(/);
  assert.match(report, /<BuklodScopeFaithMonitoringAdminFeedbackCard/);
});
