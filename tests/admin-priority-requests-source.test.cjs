const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = (path) => fs.readFileSync(path, 'utf8');
const source = read('src/lib/buklodAdminPriority.ts');
const inbox = read('src/app/admin/priority-requests.tsx');
const banner = read('src/components/AdminPriorityBanner.tsx');
const admin = read('src/app/admin/index.tsx');
const privacy = read('src/app/admin/privacy/index.tsx');

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
  assert.match(inbox, /failedSources\.length/);
  assert.match(inbox, /cappedSources\.length/);
  assert.match(banner, /unreadSupportAlerts/);
});

test('all review destinations keep their existing authorization boundaries', () => {
  for (const destination of [
    '/admin/bsoc-support', '/admin/sponsors', '/admin/account-recovery',
    '/admin/content-reports', '/admin/attendance/focus-apps/payments',
    '/admin/faith-payments', '/admin/privacy', '/admin/points-r2-monitor',
    '/admin/economy-operations',
  ]) {
    assert.ok(source.includes(destination), 'missing review route ' + destination);
  }
  assert.match(source, /Promise\.allSettled/);
  assert.doesNotMatch(source, /\.update\(|\.insert\(|\.delete\(/);
});

test('privacy deletion requests are visible but never deleted automatically', () => {
  assert.match(privacy, /ACCOUNT DELETION REQUESTS/);
  assert.match(privacy, /\.from\('account_deletion_requests'\)/);
  assert.match(privacy, /does not delete accounts automatically/);
  assert.doesNotMatch(privacy, /\.from\('account_deletion_requests'\)[\s\S]{0,160}\.delete\(/);
});
