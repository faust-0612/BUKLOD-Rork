import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

// Bundle local TS source into a data module for the zero-dependency Node 22 CI gate.
const corpusSource = read('src/lib/season2/buklodProverbsKjvFullR1.ts');
const selectionSource = read('src/lib/season2/buklodDailyProverbsR1.ts');
const inlinedSelection = selectionSource.replace(
  /^import \{ PROVERBS_KJV_BY_CHAPTER \} from '\.\/buklodProverbsKjvFullR1';\s*/m,
  '',
);
assert.notEqual(inlinedSelection, selectionSource, 'The full Proverbs corpus must be imported by the selector');
const javascript = stripTypeScriptTypes(corpusSource + '\n' + inlinedSelection);
const {
  DAILY_PROVERBS, PROVERBS_KJV_BY_CHAPTER, TOTAL_PROVERBS_VERSES,
  PROVERBS_CYCLE_ANCHOR_MANILA, manilaProverbsDate,
  dailyProverbForDate, millisecondsUntilNextManilaDate,
} = await import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64'));

const dateAtDay = day => new Date(Date.UTC(2026, 11, 6 + day)).toISOString().slice(0, 10);

test('full Proverbs contains 31 authentic numbered chapters and 915 verses with an offline text', () => {
  assert.equal(PROVERBS_KJV_BY_CHAPTER.length, 31);
  assert.equal(TOTAL_PROVERBS_VERSES, 915);
  assert.equal(PROVERBS_KJV_BY_CHAPTER.reduce((n, chapter) => n + chapter.length, 0), 915);
  assert.equal(PROVERBS_KJV_BY_CHAPTER[0][6], 'The fear of the LORD is the beginning of knowledge: but fools despise wisdom and instruction.');
  assert.equal(PROVERBS_KJV_BY_CHAPTER[30][30], 'Give her of the fruit of her hands; and let her own works praise her in the gates.');
  assert.equal(DAILY_PROVERBS.length, 31, 'Keep 31 edited EN/Fil reflection overrides without capping the verse rotation');
});

test('every single one of 915 consecutive Manila days has a unique Bible reference before the automatic restart', () => {
  assert.equal(PROVERBS_CYCLE_ANCHOR_MANILA, '2026-12-06');
  const observed = new Set();
  for (let i = 0; i < TOTAL_PROVERBS_VERSES; i++) {
    const verse = dailyProverbForDate(dateAtDay(i));
    const id = verse.chapter + ':' + verse.verse;
    assert.equal(observed.has(id), false, 'Premature duplicate on offset ' + i + ': ' + id);
    observed.add(id);
    assert.equal(verse.kjv, PROVERBS_KJV_BY_CHAPTER[verse.chapter - 1][verse.verse - 1]);
    assert.ok(verse.kjv.trim().length && verse.lessonEn.trim().length && verse.lessonFil.trim().length);
  }
  assert.equal(observed.size, 915);
  assert.equal(dailyProverbForDate(dateAtDay(0)).chapter, 1);
  assert.equal(dailyProverbForDate(dateAtDay(0)).verse, 7);
  assert.deepEqual(dailyProverbForDate(dateAtDay(915)), dailyProverbForDate(dateAtDay(0)));
  assert.notDeepEqual(dailyProverbForDate(dateAtDay(914)), dailyProverbForDate(dateAtDay(0)));
  assert.deepEqual(dailyProverbForDate(dateAtDay(916)), dailyProverbForDate(dateAtDay(1)));
});

test('day-of-month, month-end, year-end and leap-day rollover never reset the verse sequence', () => {
  for (const [a, b] of [
    ['2026-11-30', '2026-12-01'],
    ['2026-12-31', '2027-01-01'],
    ['2027-01-31', '2027-02-01'],
    ['2028-02-28', '2028-02-29'],
    ['2028-02-29', '2028-03-01'],
  ]) {
    assert.notDeepEqual(dailyProverbForDate(a), dailyProverbForDate(b), a + ' must not repeat on ' + b);
  }
  for (const invalid of ['invalid', '2026-01-00', '2026-01-32', '2026-02-29', '2026-13-01']) {
    assert.throws(() => dailyProverbForDate(invalid), /Invalid Manila/);
  }
});

test('Manila midnight is deterministic regardless of device timezone', () => {
  const before = new Date('2026-11-18T15:59:59.000Z');
  const after = new Date('2026-11-18T16:00:00.000Z');
  assert.equal(manilaProverbsDate(before), '2026-11-18');
  assert.equal(manilaProverbsDate(after), '2026-11-19');
  assert.equal(millisecondsUntilNextManilaDate(before), 1025);
  assert.equal(millisecondsUntilNextManilaDate(after), 86400025);
  assert.notDeepEqual(
    dailyProverbForDate(manilaProverbsDate(before)),
    dailyProverbForDate(manilaProverbsDate(after)),
  );
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
