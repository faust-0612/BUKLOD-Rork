import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('src/app/bible/read.tsx','utf8');
test('Bible chapter scroll and verse card use full available width',()=>{
 assert.match(source,/BIBLE_EDGE_TO_EDGE_R1/);
 assert.match(source,/paddingHorizontal:\s*0,\s*\/\/ BIBLE_EDGE_TO_EDGE_R1/);
 assert.match(source,/verseReaderCard:\s*\{\s*paddingHorizontal:\s*0,\s*paddingVertical:\s*0,\s*marginHorizontal:\s*0,\s*marginVertical:\s*0,/);
 assert.match(source,/verseRow:\s*\{\s*flexDirection:\s*'row',\s*gap:\s*4,\s*paddingVertical:\s*2,\s*paddingHorizontal:\s*0,/);
});
test('Matthew Henry action remains above nav with authentic verse-only attribution',()=>{
 assert.match(source,/henryFloatingAction:\s*\{\s*position:\s*'absolute',\s*bottom:\s*76,/);
 assert.match(source,/BIBLE_HENRY_VISIBLE_R1/);
 assert.match(source,/onPress=\{\(\) => openMatthewHenry\(passageVerseNo\)\}/);
 assert.match(source,/getMatthewHenryPassage\(bibleStudy, Number\(verse\.verse_no\)\)/);
 assert.match(source,/useMatthewHenryTranslation/);
 assert.match(source,/paddingBottom: readerScrollBottom/);
});
