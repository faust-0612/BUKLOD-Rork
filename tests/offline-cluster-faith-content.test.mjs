import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(file, 'utf8');

test('offline Cluster directory mirrors saved account scopes without changing server mutation APIs', () => {
  const s = read('src/app/clusters/index.tsx');
  assert.match(s, /savedScopeClusters/);
  assert.match(s, /scope\.scope_type === 'CLUSTER' && scope\.membership_status === 'ACTIVE'/);
  assert.match(s, /visibleMyClusters/);
  assert.match(s, /if \(!online\) \{/);
  assert.match(s, /No saved Cluster membership on this device/);
});

test('offline membership gate only trusts saved active Cluster list', () => {
  const s = read('src/components/BuklodClusterMembershipGate.tsx');
  assert.match(s, /online \? context\?\.has_active_cluster : offlineMember/);
  assert.match(s, /membership_status === 'ACTIVE'/);
});

test('published Word list and details are account-scoped and cached', () => {
  const index = read('src/app/word/index.tsx');
  const detail = read('src/app/devotional/[id].tsx');
  assert.match(index, /word-published-v1/);
  assert.match(index, /word-full:/);
  assert.match(index, /eq\('is_published', true\)/);
  assert.match(detail, /word-full:/);
  assert.match(detail, /userId: accountId/);
  assert.match(detail, /This Word was not downloaded/);
});

test('Bible cache preserves exact date, translation and chapter without awarding offline points', () => {
  const reader = read('src/app/bible/read.tsx');
  const guide = read('src/app/bible/index.tsx');
  assert.match(reader, /bible-daily-plan:/);
  assert.match(reader, /bible-books-v1:/);
  assert.match(reader, /bible-chapter-v1:/);
  assert.match(reader, /if \(!online\) \{/);
  assert.match(reader, /start_bible_reading_session/);
  assert.match(guide, /No saved Daily Reading for this week/);
});

test('Show Faith saved membership opens reading even without fresh access RPC', () => {
  const panel = read('src/components/BuklodHomeFaithPanel.tsx');
  assert.match(panel, /savedActiveCluster/);
  assert.match(panel, /scopeId && !savedActiveCluster/);
});
