import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname), '..');
const faithPanel = fs.readFileSync(path.join(root, 'src/components/BuklodHomeFaithPanel.tsx'), 'utf8');
const abcIndex = fs.readFileSync(path.join(root, 'src/app/faith/abc/index.tsx'), 'utf8');

test('web scope dashboards share the detailed faith door card layout', () => {
  assert.match(faithPanel, /const compactTile = compact && Platform\.OS !== 'web'/);
  assert.match(faithPanel, /compactTile && styles\.compactShell/);
  assert.match(faithPanel, /compactTile && styles\.compactCard/);
  assert.match(faithPanel, /!compactTile && <View/);
  assert.match(faithPanel, /compactTile && \{ display: 'none' \}/);
  assert.match(faithPanel, /minHeight: compactTile \? 96 : 90/);
});

test('native compact layout and scope access checks remain in place', () => {
  assert.match(faithPanel, /const compactTile = compact && Platform\.OS !== 'web'/);
  assert.match(faithPanel, /if \(scopeId && !savedActiveCluster && \(accessLoading \|\| !access\)\)/);
  assert.match(faithPanel, /if \(dailyReadingLocked\)/);
  assert.match(faithPanel, /if \(devotionLocked\)/);
});

test('Reading, Word, ABAKA and Hymns retain their original destinations', () => {
  assert.match(faithPanel, /label="Daily Reading"[\s\S]*?pathname: '\/bible\/read'[\s\S]*?source: 'daily_plan'/);
  assert.match(faithPanel, /label="Word"[\s\S]*?router\.push\('\/word'/);
  assert.match(faithPanel, /label="ABAKA"[\s\S]*?router\.push\([\s\S]*?'\/faith\/abc'/);
  assert.match(faithPanel, /label="Hymns"[\s\S]*?router\.push\([\s\S]*?'\/faith\/hymns'/);
});

test('ABAKA door advertises the lesson progress point contract rather than 8 BP', () => {
  assert.match(abcIndex, /ABC_POINTS_PER_LESSON\s*=\s*5/);
  assert.match(faithPanel, /ABAKA ng Bagong Likha/);
  assert.match(faithPanel, /\+5 BP per verified lesson/);
  assert.doesNotMatch(faithPanel, /\+8 BP per verified lesson/);
});
