const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const reader = fs.readFileSync('src/app/bible/read.tsx','utf8');
const source = fs.readFileSync('src/lib/buklodBibleStudy.ts','utf8');
const scenic = fs.readFileSync('src/components/bible/BuklodBibleScenicHeader.tsx','utf8');
const code = stripTypeScriptTypes(source.replace(/^import .*;$/gm,''),{mode:'strip'}).replace(/^export /gm,'');
const {getMatthewHenryPassage, chooseMatthewHenryVerse, getMatthewHenryReaderSelection} = vm.runInNewContext(
  code+'\n({getMatthewHenryPassage,chooseMatthewHenryVerse,getMatthewHenryReaderSelection})',
  { useEffect(){},useState(){return []},getOfflineCache(){},setOfflineCache(){},setTimeout,clearTimeout,AbortController,
    fetch(){throw new Error('Unit test must never fetch')} },{filename:'buklodBibleStudy.js'}
);

test('Henry uses verified direct passage, explicitly related context, chapter introduction, or no record',()=>{
  const chapter={henryPassages:[{startVerse:3,endVerse:3,text:'First note'},{startVerse:7,endVerse:9,text:'Seven through nine'}],chapterIntroduction:'Opening overview'};
  assert.equal(chooseMatthewHenryVerse(chapter,8),8);
  assert.equal(getMatthewHenryReaderSelection(chapter,8).relation,'direct');
  assert.equal(getMatthewHenryPassage(chapter,5),null);
  assert.equal(chooseMatthewHenryVerse(chapter,5),5);
  assert.equal(getMatthewHenryReaderSelection(chapter,5).relation,'context');
  assert.equal(getMatthewHenryReaderSelection(chapter,5).startVerse,3);
  assert.equal(chooseMatthewHenryVerse(chapter,1),3);
  const introduction={henryPassages:[],chapterIntroduction:'Faithful historical introduction'};
  assert.equal(chooseMatthewHenryVerse(introduction,4),1);
  assert.equal(getMatthewHenryReaderSelection(introduction,1).startVerse,0);
  assert.equal(getMatthewHenryReaderSelection(introduction,1).text,introduction.chapterIntroduction);
  const unavailable={henryPassages:[],chapterIntroduction:''};
  assert.equal(chooseMatthewHenryVerse(unavailable,4),null);
  assert.equal(getMatthewHenryReaderSelection(unavailable,4),null);
});

test('Commentary remains accessible midscroll in My Bible, search, default and not Daily Plan',()=>{
  assert.match(reader,/bibleReaderSource === 'my_bible' \|\| bibleReaderSource === 'search' \|\| bibleReaderSource === ''/);
  assert.match(reader,/bibleReaderSource ===\s*'daily_plan'/);
  assert.match(reader,/accessibilityLabel="Buksan ang Matthew Henry Commentary"/);
  assert.match(reader,/style=\{styles\.henryFloatingAction\}/);
  assert.match(reader,/onPress=\{\(\) => openMatthewHenry\(passageVerseNo\)\}/);
  assert.match(reader,/getMatthewHenryReaderSelection\(bibleStudy, henryVerse\)/);
  assert.match(reader,/henryPassage\?\.startVerse === 0/);
  assert.match(reader,/Kailangan muna ng internet/);
  assert.match(reader,/\{isMyBibleMode && !!verseHenry && \(/);
});

test('Bible text is near edge-to-edge without dropping safe-bottom, highlighted verses or notes',()=>{
  assert.match(reader,/<Card style=\{styles\.verseReaderCard\}>/);
  assert.match(reader,/verseReaderCard: \{\s*paddingHorizontal: 0,\s*paddingVertical: 0,\s*marginHorizontal: 0,\s*marginVertical: 0,\s*borderWidth: 0/);
  assert.match(reader,/verseRow: \{\s*flexDirection: 'row',\s*gap: 4,\s*paddingVertical: 2,\s*paddingHorizontal: 0/);
  assert.match(reader,/paddingBottom: readerScrollBottom/);
  assert.match(reader,/paddingHorizontal: 0, \/\/ BIBLE_EDGE_TO_EDGE_R1/);
  assert.match(reader,/henryFloatingAction: \{\s*position: 'absolute',\s*bottom: 76/);
  assert.match(reader,/openBibleAnnotation\(Number\(verse\.verse_no\), cleanText\)/);
  assert.match(reader,/backgroundColor:theme\.accentSoft/);
  assert.match(scenic,/marginHorizontal:-4,marginTop:-10/);
});
