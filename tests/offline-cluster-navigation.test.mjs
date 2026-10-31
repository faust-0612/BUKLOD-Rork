import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');

test('offline Cluster navigation uses same account-scoped memberships as Profile', () => {
  const directory = read('src/app/clusters/index.tsx');
  const profile = read('src/components/BuklodProfileMembershipNav.tsx');
  assert.match(profile, /useBuklodScope/);
  assert.match(directory, /useBuklodScope/);
  assert.match(directory, /savedScopeClusters/);
  assert.match(directory, /visibleMyClusters/);
  assert.match(directory, /enterScopedWorkspace\(selectScope, id/);
  assert.match(directory, /if \(!online\)/);
  assert.doesNotMatch(directory, /if \(!online\)\s*\{[\s\S]{0,120}setMyClusters\(\[\]\)/);
});

test('offline faith navigation retains explicit scoped and dated destinations', () => {
  const panel = read('src/components/BuklodHomeFaithPanel.tsx');
  const reader = read('src/app/bible/read.tsx');
  assert.match(panel, /pathname: '\/bible\/read'/);
  assert.match(panel, /assignedDate: readingDate/);
  assert.match(panel, /router\.push\('\/word'/);
  assert.match(reader, /bible-daily-plan:/);
  assert.match(reader, /source !== 'daily_plan'/);
});
