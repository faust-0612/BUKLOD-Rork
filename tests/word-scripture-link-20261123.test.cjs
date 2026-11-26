const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const parserSource = fs.readFileSync('src/lib/buklodWordBibleReference.ts', 'utf8');
const executable = stripTypeScriptTypes(parserSource).replace(/^export /gm, '');
const parse = vm.runInNewContext(executable + '\ngetWordBibleReaderTarget', {}, {filename:'buklodWordBibleReference.js'});
const plain = value => value === null ? null : JSON.parse(JSON.stringify(value));

test('Word references open the correct Bible chapter and first verse of a range', () => {
  assert.deepEqual(plain(parse('Psalm 42:1–11')), { bookNo:19, chapterNo:42, verseNo:1 });
  assert.deepEqual(plain(parse('Psalm 42:5')), { bookNo:19, chapterNo:42, verseNo:5 });
  assert.deepEqual(plain(parse('1 Corinthians 13:4-7')), { bookNo:46, chapterNo:13, verseNo:4 });
  assert.deepEqual(plain(parse('Song of Songs 2:4')), { bookNo:22, chapterNo:2, verseNo:4 });
  assert.deepEqual(plain(parse('Awit 42:5')), { bookNo:19, chapterNo:42, verseNo:5 });
  assert.deepEqual(plain(parse('Genesis 1')), { bookNo:1, chapterNo:1, verseNo:null });
});

test('invalid or absent Word references do not open the wrong passage', () => {
  for (const input of [null, '', 'Not a verse', 'Psalm 0:9', 'Psalm 42:0', 'Psalm 42:5 extra']) {
    assert.equal(parse(input), null);
  }
});

test('Word retains paraphrase, reflection, and free-reading navigation', () => {
  const screen = fs.readFileSync('src/app/devotional/[id].tsx', 'utf8');
  assert.match(screen, /item\.scripture_text \|\| item\.key_verse/);
  assert.match(screen, /item\.reflection_text/);
  assert.match(screen, /accessibilityRole="button"/);
  assert.match(screen, /pathname: '\/bible\/read'/);
  assert.match(screen, /source: 'my_bible'/);
  assert.match(screen, /keyVerseTarget \|\| passageTarget/);
});
