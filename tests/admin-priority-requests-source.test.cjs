const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');
const source = read('src/lib/buklodAdminPriority.ts');
const inbox = read('src/app/admin/priority-requests.tsx');
const banner = read('src/components/AdminPriorityBanner.tsx');
const admin = read('src/app/admin/index.tsx');
const privacy = read('src/app/admin/privacy/index.tsx');
const threads = read('src/app/admin/bsoc-conversations.tsx');
const notifications = read('src/app/admin/bsoc-notifications.tsx');

test('system admin gets an actionable priority inbox even if executive stats fail', () => {
  assert.match(admin, /<AdminPriorityBanner \/>/);
  assert.ok(admin.indexOf('<AdminPriorityBanner />') < admin.indexOf('{showBlockingLoader ?'));
  assert.match(inbox, /<AdminGate>/);
  assert.match(banner, /hasRole\('system_admin'\)/);
  assert.match(inbox, /hasRole\('system_admin'\)/);
  assert.match(inbox, /router\.push\(item\.route as any\)/);
});

test('pending count comes from canonical RLS-protected work, not unread flags', () => {
  assert.match(source, /\.from\('user_feedback'\)/);
  assert.match(source, /count: 'exact'/);
  assert.match(source, /\.in\('status', \['new', 'triaged', 'in_progress'\]\)/);
  assert.match(source, /pendingTotal \+= result\.value\.total \?\? result\.value\.items\.length/);
  assert.match(source, /mergePendingCaseSamples/);
  assert.match(inbox, /failedSources\.length/);
  assert.match(inbox, /cappedSources\.length/);
  assert.match(banner, /unreadSupportAlerts/);
});

test('all review destinations keep their existing authorization boundaries', () => {
  for (const destination of [
    '/admin/sponsors', '/admin/account-recovery',
    '/admin/content-reports', '/admin/attendance/focus-apps/payments',
    '/admin/faith-payments', '/admin/privacy', '/admin/points-r2-monitor',
    '/admin/economy-operations',
  ]) {
    assert.ok(source.includes(destination), 'missing review route ' + destination);
  }
  assert.match(source, /bsocCaseRoute\(c\.id\)/);
  assert.match(source, /Promise\.allSettled/);
  assert.doesNotMatch(source, /\.update\(|\.insert\(|\.delete\(/);
});

test('BSOC notification opens the originating authorized thread, and preserves reply capability', () => {
  assert.match(threads, /useLocalSearchParams/);
  assert.match(threads, /isValidBdocCaseId\(routeCaseId\)/);
  assert.match(threads, /if\(!caseId\|\|!canRead\)return;/);
  assert.match(threads, /currentCase\.current!==caseId/);
  assert.match(threads, /\.from\('bsoc_case_messages'\)/);
  assert.match(threads, /canManage&&<Pressable/);
  assert.match(notifications, /bsocCaseRoute\(raw\)/);
  assert.match(notifications, /if\(!allowed\)return;/);
});

test('privacy deletion requests are visible but never deleted automatically', () => {
  assert.match(privacy, /ACCOUNT DELETION REQUESTS/);
  assert.match(privacy, /\.from\('account_deletion_requests'\)/);
  assert.match(privacy, /does not delete accounts automatically/);
  assert.doesNotMatch(privacy, /\.from\('account_deletion_requests'\)[\s\S]{0,160}\.delete\(/);
});

test('priority aging and expired/invalid dates have defined behavior', async () => {
  const { rankPriorityLevel } = await import('../src/lib/buklodAdminPriorityPolicy.ts');
  const now = Date.parse('2026-11-12T12:00:00Z');
  assert.equal(rankPriorityLevel('normal', '2026-11-12T11:59:00Z', now), 1);
  assert.equal(rankPriorityLevel('high', '2026-11-12T11:59:00Z', now), 2);
  assert.equal(rankPriorityLevel('urgent', '2026-11-12T11:59:00Z', now), 3);
  assert.equal(rankPriorityLevel('high', '2026-11-09T12:00:00Z', now), 3);
  assert.equal(rankPriorityLevel('normal', '2026-11-09T12:00:00Z', now), 2);
  assert.equal(rankPriorityLevel('normal', 'not-a-date', now), 1);
  assert.equal(rankPriorityLevel('high', '2026-11-20T12:00:00Z', now), 2);
});

test('sampling is bounded, deduplicated, newest/oldest-inclusive and stable', async () => {
  const { mergePendingCaseSamples } = await import('../src/lib/buklodAdminPriorityPolicy.ts');
  assert.deepEqual(mergePendingCaseSamples(
    [{id:'new',title:'newest'}, {id:'overlap',title:'latest'}],
    [{id:'old',title:'oldest'}, {id:'overlap',title:'old'}],
  ), [
    {id:'new',title:'newest'}, {id:'overlap',title:'old'}, {id:'old',title:'oldest'},
  ]);
});

test('only strict UUIDs are allowed into a BSOC deep link', async () => {
  const { bsocCaseRoute, isValidBdocCaseId } = await import('../src/lib/buklodAdminPriorityPolicy.ts');
  const id='c4a5611d-4536-4b4a-93a8-0214183c9e17';
  assert.equal(isValidBdocCaseId(id),true);
  assert.equal(bsocCaseRoute(id),'/admin/bsoc-conversations?caseId='+id);
  for (const bad of ['..','../../admin/sponsors', id+'?x=1','',null,undefined, 'c4a5611d']) {
    assert.equal(isValidBdocCaseId(bad),false);
    assert.equal(bsocCaseRoute(bad),'/admin/bsoc-conversations');
  }
});
