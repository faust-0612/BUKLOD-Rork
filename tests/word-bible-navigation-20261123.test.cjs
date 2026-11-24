const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const screen = fs.readFileSync('src/app/devotional/[id].tsx', 'utf8');
const reader = fs.readFileSync('src/app/bible/read.tsx', 'utf8');

test('Word opens the full My Bible reader, never guided Daily Reading', () => {
  assert.match(screen, /pathname: '\/bible\/read'/);
  assert.match(screen, /source: 'my_bible'/);
  assert.match(reader, /bibleReaderSource === 'my_bible'/);
  assert.match(reader, /const requestedVerse =/);
  assert.match(reader, /passageVerseNo/);
});

test('Word and ad integration are preserved and passage navigation is accessible', () => {
  assert.match(screen, /<BuklodOccasionalAd placement="devotion" \/>/);
  assert.match(screen, /getWordBibleReaderTarget\(item\.bible_passage\)/);
  assert.match(screen, /getWordBibleReaderTarget\(item\.key_verse\)/);
  assert.match(screen, /accessibilityRole="button"/);
  assert.match(screen, /item\.reflection_text/);
});
