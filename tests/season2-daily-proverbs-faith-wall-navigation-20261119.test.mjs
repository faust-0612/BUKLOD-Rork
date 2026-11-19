import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const dataSource = read('src/lib/season2/buklodDailyProverbsR1.ts');
const compiled = ts.transpileModule(dataSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true },
  reportDiagnostics: true,
});
assert.deepEqual(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [], []);
const module = { exports: {} };
new Function('exports', 'require', 'module', compiled.outputText)(module.exports, require, module);
const {
  DAILY_PROVERBS, manilaProverbsDate, dailyProverbForDate, millisecondsUntilNextManilaDate,
} = module.exports;

test('one correct, stable Proverbs chapter/verse every Manila calendar day', () => {
  assert.equal(DAILY_PROVERBS.length, 31);
  assert.equal(new Set(DAILY_PROVERBS.map(v => v.chapter + ':' + v.verse)).size, 31);
  for (let day = 1; day <= 31; day++) {
    const verse = dailyProverbForDate('2026-01-' + String(day).padStart(2, '0'));
    assert.equal(verse, DAILY_PROVERBS[day - 1]);
    assert.ok(verse.chapter >= 1 && verse.chapter <= 31);
    assert.ok(verse.verse > 0);
    assert.ok(verse.kjv.length > 25 && verse.lessonEn && verse.lessonFil);
  }
  assert.throws(() => dailyProverbForDate('invalid'), /Invalid Manila date key/);
  assert.throws(() => dailyProverbForDate('2026-01-00'), /Invalid Manila calendar day/);
  assert.throws(() => dailyProverbForDate('2026-01-32'), /Invalid Manila calendar day/);
});

test('Manila midnight is deterministic regardless of device timezone', () => {
  const before = new Date('2026-11-18T15:59:59.000Z');
  const after = new Date('2026-11-18T16:00:00.000Z');
  assert.equal(manilaProverbsDate(before), '2026-11-18');
  assert.equal(manilaProverbsDate(after), '2026-11-19');
  assert.equal(millisecondsUntilNextManilaDate(before), 1025);
  assert.equal(millisecondsUntilNextManilaDate(after), 86400025);
});

test('Show Faith card is read-only, lazy, localized and navigates to canonical Bible', () => {
  const ui = read('src/components/BuklodSeason2ProverbsDailyVerse.tsx');
  assert.match(ui, /if \(!showFaith\) return null/);
  assert.match(ui, /activeScope\?\.show_faith_content/);
  assert.match(ui, /useBuklodLifeLanguage/);
  assert.match(ui, /get_bible_chapter/);
  assert.match(ui, /p_translation_code: 'ASD'/);
  assert.match(ui, /p_book_no: 20/);
  assert.match(ui, /withBuklodTimeout/);
  assert.match(ui, /AsyncStorage\.getItem/);
  assert.match(ui, /new Intl\.DateTimeFormat/);
  assert.match(ui, /AppState\.addEventListener/);
  assert.match(ui, /useFocusEffect/);
  assert.match(ui, /\/bible\/read\?book=20/);
  assert.doesNotMatch(ui, /rpc\(['"](?:award|grant|claim|earn)|\.from\(['"](?:buklod_points|wallet|qmp)/i);
});

test('Public/scoped walls show faith card without displacing first-view ads', () => {
  const publicWall = read('src/app/(tabs)/buklod.tsx');
  const scopedWall = read('src/components/BuklodExclusiveScopeCommunity.tsx');
  assert.match(publicWall, /<BuklodSeason2ProverbsDailyVerse\s*\/>/);
  assert.match(scopedWall, /mode === 'wall' && scope\.show_faith_content \?/);
  assert.match(scopedWall, /<BuklodSeason2ProverbsDailyVerse enabled\s*\/>/);
  assert.ok(publicWall.indexOf('<BuklodFirstViewAd\n    placement="community_entry"') <
    publicWall.indexOf('<BuklodSeason2ProverbsDailyVerse />'));
  assert.ok(scopedWall.indexOf('<BuklodFirstViewAd\n            placement=') <
    scopedWall.indexOf('<BuklodSeason2ProverbsDailyVerse enabled />'));
  assert.match(publicWall, /<BuklodCommunityInlineAd/);
  assert.match(scopedWall, /<BuklodCommunityInlineAd/);
});
