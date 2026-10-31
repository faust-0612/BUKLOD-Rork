const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const bible = fs.readFileSync('src/app/bible/read.tsx', 'utf8');
const nav = fs.readFileSync('src/components/BuklodPersistentBottomNav.tsx', 'utf8');
const picker = fs.readFileSync('src/components/bible/MyBibleQuickNavigator.tsx', 'utf8');

test('Bible occupies the fourth public nav slot without deleting Connect routes', () => {
  assert.match(nav, /key: 'bible', route: '\/bible\/read\?source=my_bible', icon: 'book-open-variant', label: 'Bible'/);
  assert.match(nav, /key: 'community', route: '\/buklod'/);
  assert.match(nav, /route !== '\/bible\/read\?source=my_bible'/);
  assert.match(nav, /pathname === '\/bible\/read'/);
  assert.doesNotMatch(nav, /key: 'connect'.*label: 'Connect'/);
  assert.match(bible, /router\.push\('\/bible\/search'\)/);
});

test('reader-first mode preserves daily flow and opens search results at verse', () => {
  assert.match(bible, /bibleReaderSource === 'my_bible' \|\| bibleReaderSource === 'search'/);
  assert.match(bible, /bibleReaderSource ===\s*'daily_plan'/);
  assert.match(bible, /\{!isMyBibleMode && \(\s*<Card>/);
  assert.match(bible, /<MyBibleQuickNavigator/);
  assert.match(bible, /source === 'daily_plan'/);
  assert.match(bible, /selectedVerse=\{passageVerseNo\}/);
  assert.match(bible, /onClearVerse=\{\(\) => setPassageVerseNo\(null\)\}/);
  assert.match(bible, /isMyBibleMode\s*\? passageVerseNo\s*: passageVerseNo \?\?/);
  assert.match(bible, /isMyBibleMode \? passageVerseNo !== null : requestedVerse > 0/);
});

test('modal offers book search, OT/NT, chapter and exact verse controls', () => {
  assert.match(picker, /type Book = \{ book_no: number; book_name: string; chapter_count: number \}/);
  assert.match(picker, /'book' \| 'chapter' \| 'verse'/);
  assert.match(picker, /book\.book_no <= 39 : book\.book_no > 39/);
  assert.match(picker, /book\.book_name\.toLocaleLowerCase\(\)\.includes\(q\)/);
  assert.match(picker, /onSelectBook\(book\)/);
  assert.match(picker, /onSelectChapter\(chapter\)/);
  assert.match(picker, /onSelectVerse\(verse\)/);
  assert.match(picker, /onClearVerse\(\)/);
  assert.match(picker, /accessibilityLabel="Pumili ng aklat sa Bibliya"/);
});

test('audio and font options are optional and keep narration on the existing provider', () => {
  assert.match(bible, /setShowBibleAudio\(value => !value\)/);
  assert.match(bible, /setShowBibleTextSettings\(value => !value\)/);
  assert.match(bible, /!isMyBibleMode \|\| showBibleAudio \|\| bibleNarration\.status !== 'idle'/);
  assert.match(bible, /<BuklodBibleNarrationBar/);
  assert.match(bible, /!isMyBibleMode \|\| showBibleTextSettings/);
});
