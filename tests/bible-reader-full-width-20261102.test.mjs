import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync('src/app/bible/read.tsx', 'utf8');

test('portrait Bible reader uses a compact horizontal gutter', () => {
  assert.match(reader, /paddingHorizontal:\s*bibleLandscape\s*\?\s*14\s*:\s*6/);
});

test('landscape retains a wider reading gutter without constraining screen width', () => {
  const content = reader.slice(reader.indexOf('contentContainerStyle={[', reader.indexOf('return (\n    <ScrollView')), reader.indexOf('>\n      {isMyBibleMode'));
  assert.match(content, /width:\s*'100%'/);
  assert.match(content, /alignSelf:\s*'center'/);
  assert.match(content, /bibleLandscape\s*\?\s*14\s*:\s*6/);
});

test('verse rows reclaim horizontal space while preserving readable line height', () => {
  assert.match(reader, /verseRow:\s*\{[\s\S]*?gap:\s*7,[\s\S]*?paddingHorizontal:\s*2/);
  assert.match(reader, /verseText:\s*\{[\s\S]*?fontSize:\s*16\.5,[\s\S]*?lineHeight:\s*26/);
});

test('reader functionality and safe-area bottom inset remain intact', () => {
  assert.match(reader, /paddingBottom:\s*readerScrollBottom/);
  assert.match(reader, /useBuklodScrollBottomInset\(\{ extra: 38 \}\)/);
  assert.match(reader, /playBibleNarration/);
  assert.match(reader, /saveBibleAnnotation/);
  assert.match(reader, /moveChapter\(-1\)/);
  assert.match(reader, /moveChapter\(1\)/);
});
