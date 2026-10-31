const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/lib/buklodBibleStudy.ts', 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
}).outputText;
const moduleValue = { exports: {} };
vm.runInNewContext(transpiled, {
  module: moduleValue,
  exports: moduleValue.exports,
  require: key => {
    if (key === 'react') return { useEffect: () => {}, useState: () => [] };
    if (key === '@/lib/offlineCache') return {};
    throw new Error('Unexpected import: ' + key);
  },
  setTimeout,
  clearTimeout,
  AbortController,
  fetch: () => { throw new Error('Parser test must never access network'); },
}, { filename: 'buklodBibleStudy.js' });
const {
  studyBookCode, strongLexiconUrl, parseMatthewHenryChapter,
  parseTaggedKjvChapter, alignKjvStrongWords,
} = moduleValue.exports;

test('canonical 66-book indices map to exact Matthew Henry and tagged KJV chapter endpoints', () => {
  assert.equal(studyBookCode(10), '2SA');
  assert.equal(studyBookCode(43), 'JHN');
  assert.equal(studyBookCode(1), 'GEN');
  assert.equal(studyBookCode(67), null);
  assert.ok(source.includes('https://bible.helloao.org/api/c/matthew-henry/'));
  assert.ok(source.includes('https://jsonbible.org/v1/kjvstrongs/'));
  assert.match(source, /String\(bookNo\)\.padStart\(2,'0'\)/);
  assert.match(source, /String\(chapterNo\)\.padStart\(3,'0'\)/);
});

test('public-domain commentary buttons show only where an actual verse entry exists', () => {
  const c = parseMatthewHenryChapter({ chapter: { content: [
    { type: 'verse', number: 1, content: ['Explanation of verses 1-2'] },
    { type: 'verse', number: 3, content: [{ text: 'Correct passage' }] },
    { type: 'heading', content: ['Verse 7'] },
    { type: 'verse', number: 6, content: [] },
  ] } });
  assert.equal(c[1], 'Explanation of verses 1-2');
  assert.equal(c[3], 'Correct passage');
  assert.equal(c[7], undefined);
  assert.equal(c[6], undefined);
  assert.equal(Object.keys(parseMatthewHenryChapter({chapter:{content:[]}})).length,0);
});

test('Strong concordance only highlights source-matching KJV words with valid H/G IDs', () => {
  const data=parseTaggedKjvChapter({ '1': {t:'In the beginning God',w:[
    ['In',['H1']],['the',['H2']],['beginning',['H7225']],['God',['H430']],['bad',['URL:JAVASCRIPT']]
  ]}});
  assert.equal(data[1].length,4);
  const parts=alignKjvStrongWords('In the beginning God',data[1]);
  assert.equal(parts.map(p=>p.text).join(''), 'In the beginning God');
  assert.ok(parts.some(p=>p.strongs.includes('H7225')));
  assert.equal(alignKjvStrongWords('Completely different words',data[1]).length,1);
  assert.equal(alignKjvStrongWords('No matching KJV markers',undefined)[0].strongs.length,0);
});

test('Strong lexicon URLs are direct exact entries, not arbitrary user-provided URLs', () => {
  assert.equal(strongLexiconUrl('H7225'), 'https://biblehub.com/hebrew/7225.htm');
  assert.equal(strongLexiconUrl('G0025'), 'https://biblehub.com/greek/25.htm');
  assert.equal(strongLexiconUrl('javascript:alert(1)'), null);
  assert.equal(strongLexiconUrl('H0'), null);
});
