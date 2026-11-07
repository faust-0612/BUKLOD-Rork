import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const parser = await import('data:text/javascript,' +
  encodeURIComponent(stripTypeScriptTypes(read('src/lib/kabihasnang-ligaw/paragraphBlocks.ts'))));
const split = parser.splitKlManuscriptBlocks;

test('KL Chapter 2 whitespace-only blank lines never merge neighboring paragraphs', () => {
  // The released Chapter 2 contains this exact whitespace shape: one
  // intended line break followed by a blank line containing one space.
  const manuscript = [
    'Nawala ang dalawang tinig.',
    '',
    'Hindi sabay. Nauna ang tinig ng bata, na tila natakot sa sariling alingawngaw.',
    'Nang tuluyang tumahimik ang lahat, napansin ni Phan na nanginginig ang kanyang mga tuhod.',
    ' ',
    'Paglingon niya, hindi na nakatayo sa tabi niya ang bata.',
    '',
    'Nakaupo na ito sa lupa, nakatingin sa sarili nitong mga paa.',
  ].join('\n');

  const blocks = split(manuscript);
  assert.equal(blocks.length, 4);
  assert.equal(blocks[1],
    'Hindi sabay. Nauna ang tinig ng bata, na tila natakot sa sariling alingawngaw.\n' +
    'Nang tuluyang tumahimik ang lahat, napansin ni Phan na nanginginig ang kanyang mga tuhod.');
  assert.equal(blocks[2], 'Paglingon niya, hindi na nakatayo sa tabi niya ang bata.');
  assert.equal(blocks[3], 'Nakaupo na ito sa lupa, nakatingin sa sarili nitong mga paa.');
  assert.equal(
    blocks.join(' ').replace(/\s+/g,' ').trim(),
    manuscript.replace(/\s+/g,' ').trim(),
    'All prose survives display normalization; no partial sentence can be dropped'
  );
});

test('CRLF, blank tabs, BOM and extra blank lines resolve without empty fake paragraphs', () => {
  assert.deepEqual(split('\uFEFFA\r\n\r\n\t\r\nB\r\n \r\nC'), ['A','B','C']);
  assert.deepEqual(split('A\n\n\nB'), ['A','B']);
  assert.deepEqual(split('A\nB'), ['A\nB'], 'Intentional single line break remains');
  assert.deepEqual(split(''), []);
});

test('admin preview, canonical reader and dynamic reader share identical splitter', () => {
  const manuscript = read('src/lib/kabihasnang-ligaw/manuscript.ts');
  const preview = read('src/components/kabihasnang-ligaw/KlAdminPreview.tsx');
  const dynamic = read('src/components/kabihasnang-ligaw/KlDynamicLibrary.tsx');
  assert.match(manuscript, /splitKlManuscriptBlocks\(source\)/);
  assert.match(preview, /splitKlManuscriptBlocks\(bundle\.manuscript\)/);
  assert.match(dynamic, /splitKlManuscriptBlocks\(text\)/);
  assert.doesNotMatch(manuscript, /split\(\/\\n\{2,\}\//);
});

test('released Android reader renders ordinary prose directly and keeps glossary links', () => {
  const reader = read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
  assert.match(reader, /const hasDictionaryLinks = dictionaryParts\.some/);
  assert.match(reader, /\)\) : displayText\}/);
  assert.match(reader, /onPress=\{\(\) => setOpenTerm\(part\.term\)\}/);
  assert.match(reader, /styles\.body/);
  const prose = reader.slice(reader.indexOf('const displayText = paragraphDisplayText'),
    reader.indexOf('<KlSceneMotion'));
  assert.doesNotMatch(prose, /numberOfLines=|ellipsizeMode=/,
    'Story content must not acquire preview-card truncation');
});

test('scrolling released prose cannot go behind native Android status bar', () => {
  const reader = read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
  assert.match(reader, /Platform\.OS === 'android'[\s\S]*?Math\.max\(insets\.top, StatusBar\.currentHeight \?\? 0\)/);
  assert.match(reader, /style=\{\[styles\.page, androidTopInset > 0 && \{ marginTop: androidTopInset \}\]\}/);
  assert.match(reader, /paddingTop: 18 \+ \(Platform\.OS === 'android' \? 0 : insets\.top\)/);
});
