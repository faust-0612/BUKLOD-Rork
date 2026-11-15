const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync('src/lib/buklodBibleStudy.ts', 'utf8');
// Node 22 strips types without requiring all Expo/React packages in the
// low-cost engineering gate. Test the actual production parser functions.
const standalone = stripTypeScriptTypes(
  source.replace(/^import .*;$/gm, ''),
  { mode: 'strip' },
).replace(/^export /gm, '');
const {
  studyBookCode, strongLexiconUrl, parseMatthewHenryChapter,
  parseMatthewHenryPassages, getMatthewHenryPassage,
  parseTaggedKjvChapter, alignKjvStrongWords,
} = vm.runInNewContext(standalone + '\n({ studyBookCode, strongLexiconUrl, parseMatthewHenryChapter, parseMatthewHenryPassages, getMatthewHenryPassage, parseTaggedKjvChapter, alignKjvStrongWords })', {
  useEffect: () => {},
  useState: () => [],
  getOfflineCache: () => {},
  setOfflineCache: () => {},
  setTimeout,
  clearTimeout,
  AbortController,
  fetch: () => { throw new Error('Parser test must never access network'); },
}, { filename: 'buklodBibleStudy.js' });

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

test('Henry passage coverage is explicit; unlabeled gaps are context only, not fabricated verse commentary',()=>{
  const p = parseMatthewHenryPassages({chapter:{content:[
    {type:'heading',content:['Verses 1-3']},
    {type:'verse',number:1,content:['Shared source passage']},
    {type:'verse',number:7,content:['Verse seven']},
    {type:'verse',number:11,endVerse:13,content:['Explicit section']},
  ]}});
  assert.equal(p.length,3);
  assert.equal(p[0].endVerse,3);
  const chapter={henryPassages:p};
  assert.equal(getMatthewHenryPassage(chapter,2).relation,'direct');
  assert.equal(getMatthewHenryPassage(chapter,4),null);
  assert.equal(getMatthewHenryPassage(chapter,4,{allowContext:true}).relation,'context');
  assert.equal(getMatthewHenryPassage(chapter,4,{allowContext:true}).startVerse,1);
  assert.equal(getMatthewHenryPassage(chapter,12).relation,'direct');
  assert.equal(getMatthewHenryPassage(chapter,7).endVerse,7);
  assert.equal(getMatthewHenryPassage(chapter,176),null);
  assert.equal(getMatthewHenryPassage({henryPassages:[]},3),null);
});

test('language metadata aliases and bounded commentary chunks preserve text order', () => {
  const localeSrc = fs.readFileSync('src/lib/buklodHenryTranslation.ts', 'utf8');
  const localeJs = stripTypeScriptTypes(localeSrc.replace(/^import .*;$/gm, ''), { mode: 'strip' })
    .replace(/^export /gm, '');
  const { normalizeHenryLanguage, splitHenryTranslation } = vm.runInNewContext(
    localeJs + '\n({ normalizeHenryLanguage, splitHenryTranslation })',
    { setTimeout, clearTimeout, fetch: () => { throw new Error('No network in language tests'); } },
    { filename: 'buklodHenryTranslation.js' },
  );
  assert.equal(normalizeHenryLanguage('eng', 'KJV'), 'en');
  assert.equal(normalizeHenryLanguage('en-US', 'KJV'), 'en');
  assert.equal(normalizeHenryLanguage('fil-PH', 'ASD'), 'tl');
  assert.equal(normalizeHenryLanguage('tgl', 'ASD'), 'tl');
  assert.equal(normalizeHenryLanguage('', 'ASD'), 'tl');
  assert.equal(normalizeHenryLanguage('unsupported', 'KJV'), 'en');
  const sample = 'One two. Three four. Five six. Seven eight.';
  const chunks = splitHenryTranslation(sample, 16);
  assert.equal(chunks.join(' '), sample);
  assert.ok(chunks.every(piece => piece.length <= 16));
  assert.deepEqual(Array.from(splitHenryTranslation('  ')), []);
});

test('live Free Use Bible API sparse verse-anchor layout never fabricates covered verse ranges', () => {
  const genesis = parseMatthewHenryPassages({ chapter: { number: 1, content: [
    { type: 'verse', number: 1, content: ['In these verses we have the work of creation.'] },
    { type: 'verse', number: 3, content: ['An account of the first day.'] },
    { type: 'verse', number: 6, content: ['The second day work.'] },
  ] } });
  assert.equal(genesis.length, 3);
  assert.equal(genesis[0].endVerse, 1);
  assert.equal(getMatthewHenryPassage({henryPassages:genesis},2), null);
  assert.equal(getMatthewHenryPassage({henryPassages:genesis},3).relation, 'direct');
  const john = parseMatthewHenryPassages({chapter:{number:3,content:[
    {type:'verse',number:1,content:['Nicodemus comes to Jesus']},
    {type:'verse',number:22,content:['Into Judea']},
  ]}});
  assert.equal(getMatthewHenryPassage({henryPassages:john},21), null);
  assert.equal(getMatthewHenryPassage({henryPassages:john},22).relation, 'direct');
  const sparse = parseMatthewHenryPassages({chapter:{number:1,content:[{type:'verse',number:9,content:['Late first commentary']}]}});
  assert.equal(getMatthewHenryPassage({henryPassages:sparse},2), null);
});


test('1 Kings 3:6 cannot borrow unrelated high-place commentary anchored at verse 4', () => {
  const passages = parseMatthewHenryPassages({ chapter: { content: [
    {type:'verse',number:4,content:['The sacrifice on the high place']},
    {type:'verse',number:7,content:['Solomon responds with humility']},
  ] } });
  const study = {henryPassages:passages};
  assert.equal(getMatthewHenryPassage(study,6), null);
  assert.equal(getMatthewHenryPassage(study,4).startVerse, 4);
  assert.equal(getMatthewHenryPassage(study,7).startVerse, 7);
  const related = getMatthewHenryPassage(study,6,{allowContext:true});
  assert.equal(related.relation,'context');
  assert.equal(related.startVerse,4);
});
