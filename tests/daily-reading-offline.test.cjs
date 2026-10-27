const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src/app/bible/index.tsx'),
  'utf8',
);

test('Daily Reading retains an account-scoped offline week and guarded responses', () => {
  assert.match(source, /getOfflineCache<DailyReadingSnapshot>/);
  assert.match(source, /setOfflineCache<DailyReadingSnapshot>/);
  assert.match(source, /userId: accountId, allowStale: true/);
  assert.match(source, /authenticatedUserId !== accountId/);
  assert.match(source, /requestId !== loadSequenceRef\.current \|\| activeAccountRef\.current !== accountId/);
  assert.match(source, /setAssignments\(cache\.data\.assignments\)/);
  assert.match(source, /setSubmissions\(cache\.data\.submissions\)/);
});

test('Unsubmitted text is restored per account and assignment without replaying photo uploads', () => {
  assert.match(source, /DAILY_READING_DRAFT_CACHE}:\$\{selected\.id\}/);
  assert.match(source, /getOfflineCache<DailyReadingDraft>/);
  assert.match(source, /setOfflineCache<DailyReadingDraft>/);
  assert.match(source, /draftOwner !== draftKey/);
  assert.match(source, /removeOfflineCache\(draftKey, user\.id\)/);
  assert.match(source, /AppState\.addEventListener\('change'/);
  assert.match(source, /persistCurrentDraft\(\); setSelectedDate\(date\)/);
  assert.doesNotMatch(source, /enqueueOffline\w*\([\s\S]{0,100}daily_bible/i);
});

test('Successful submission cannot be invalidated by a follow-up refresh failure', () => {
  const rpc = source.indexOf("rpc('complete_my_daily_bible_reading_v3'");
  const acknowledgment = source.indexOf('setCompletionAcknowledgedKey(draftKey)', rpc);
  const refresh = source.indexOf('await load();', acknowledgment);
  assert.ok(rpc >= 0 && acknowledgment > rpc && refresh > acknowledgment);
  assert.match(source, /if \(!rpcAttempted && newlyUploaded\.length\)/);
  assert.match(source, /completeBusyRef\.current = true/);
  assert.match(source, /completeBusyRef\.current = false/);
});
