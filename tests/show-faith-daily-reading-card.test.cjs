const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src/components/BuklodHomeFaithPanel.tsx'),
  'utf8',
);

test('Show Faith Daily Reading card isolates cache by account and Philippine day', () => {
  assert.ok(source.includes('show-faith-today:v2:${readingDate}'));
  assert.ok(source.includes('userId: readingCacheUser'));
  assert.ok(source.includes('cached?.data?.reading_date !== readingDate'));
  assert.ok(source.includes('readingOwner === readingCacheUser'));
  assert.ok(source.includes('reading?.reading_date === readingDate'));
  assert.ok(!source.includes("getOfflineCache<TodayReading>('show-faith-today:v1'"));
});

test('Show Faith Daily Reading validates the server date before updating its card', () => {
  assert.ok(source.includes('returnedDate !== readingDate'));
  assert.ok(source.includes('reading_date: returnedDate'));
  assert.ok(source.includes('setReading(next)'));
  assert.ok(source.includes('displayedReading'));
  assert.ok(source.includes('assignedDate: readingDate'));
});

test('Card changes its Philippine calendar day on navigation focus and app foreground', () => {
  assert.ok(source.includes('setReadingDate(getManilaReadingDate())'));
  assert.ok(source.includes("AppState.addEventListener('change'"));
  assert.ok(source.includes("state === 'active'"));
  assert.ok(source.includes('subscription.remove()'));
  assert.ok(source.includes('Date.now() + 8 * 60 * 60 * 1000'));
});
