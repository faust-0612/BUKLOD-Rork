import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const panel = read('src/components/BuklodHomeFaithPanel.tsx');
const scope = read('src/app/scope/index.tsx');
const cluster = read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
const organization = read('src/components/BuklodScopeHomeDashboard.tsx');
const abc = read('src/app/faith/abc/index.tsx');

test('Bible Reading, Word and ABAKA share the same scoped compact door layout', () => {
  for (const source of [scope, cluster, organization]) {
    assert.match(source, /<BuklodHomeFaithPanel scopeId=\{scope\.scope_id\} compact\s*\/>/);
  }
  for (const label of ['Daily Reading', 'Word', 'ABAKA']) {
    assert.ok(panel.includes(`label="${label}"`));
  }
  assert.match(panel, /compactCaption/);
  assert.match(panel, /doorAccent/);
});

test('three door captions remain legible and preserve distinct content identity', () => {
  assert.match(panel, /compactCaption=\{displayedReading\?\.bible_reference/);
  assert.match(panel, /compactCaption="Daily devotional"/);
  assert.match(panel, /compactCaption="A–Z lessons"/);
  assert.match(panel, /label === 'Daily Reading' \|\| label === 'Word' \|\| label === 'ABAKA'/);
  assert.match(panel, /minHeight: compact \? 108 : 72/);
});

test('ABAKA door uses the same reward as the actual lesson progress', () => {
  assert.match(abc, /const ABC_POINTS_PER_LESSON =\s*5;/);
  assert.match(panel, /\+5 BP per verified lesson/);
  assert.doesNotMatch(panel, /\+8 BP per verified lesson/);
});

test('canonical Bible, Word and ABAKA destinations remain unchanged', () => {
  assert.match(panel, /pathname: '\/bible\/read'/);
  assert.match(panel, /source: 'daily_plan'/);
  assert.match(panel, /assignedDate: readingDate/);
  assert.match(panel, /router\.push\('\/word' as any\)/);
  assert.match(panel, /'\/faith\/abc' as any/);
});

test('Cluster access and offline daily reading safeguards remain intact', () => {
  assert.match(panel, /savedActiveCluster/);
  assert.match(panel, /scopeId && !savedActiveCluster && \(accessLoading \|\| !access\)/);
  assert.match(panel, /dailyReadingLocked/);
  assert.match(panel, /devotionLocked/);
  assert.match(panel, /show-faith-today:v2:\$\{readingDate\}/);
  assert.match(panel, /readingOwner === readingCacheUser/);
});
