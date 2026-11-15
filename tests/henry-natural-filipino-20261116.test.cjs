const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync('src/lib/buklodHenryTranslation.ts','utf8');
const js = stripTypeScriptTypes(source.replace(/^import .*;$/gm,''), {mode:'strip'}).replace(/^export /gm,'');
const ctx = {setTimeout,clearTimeout,Math,fetch:()=>{throw new Error('Translator test must never access network')}};
const functions = vm.runInNewContext(js + '\n({ prepareHenryEnglishForFilipino, polishHenryFilipinoTranslation, splitHenryTranslation, normalizeHenryLanguage, formatHenryBibleReferences, paragraphizeHenryEnglish })',ctx,{filename:'buklodHenryTranslation.js'});
const { prepareHenryEnglishForFilipino, polishHenryFilipinoTranslation, splitHenryTranslation, formatHenryBibleReferences, paragraphizeHenryEnglish } = functions;

test('Matthew Henry historic worship idioms are clarified before ML Kit without changing the original source', () => {
  const original = "The nearer we come to the rule in our worship the more reason we have to expect the tokens of God's presence. Where God records his name, there he will meet us.";
  const prepared=prepareHenryEnglishForFilipino(original);
  assert.match(prepared,/signs that God is present/);
  assert.ok(!prepared.includes('tokens of'));
  assert.match(original,/tokens of God's presence/);
  assert.match(prepared,/Where God records his name/);
  assert.equal(prepareHenryEnglishForFilipino('Tokens of exchange and financial credits.'),'Tokens of exchange and financial credits.');
});

test('complete idioms are smoothed while preserving Divine speaker, negation and references', () => {
  const input = "The more we abound in God's work the more comfort we may expect in him; if the day has been busy for him, the night will be easy in him. Silence and retirement befriend our communion with God. In a dream, when he was asleep, his senses locked up, that God's access to his mind might be the more free and immediate. 1 Kings 3:5.";
  const output=prepareHenryEnglishForFilipino(input);
  assert.match(output,/devote ourselves to God/);
  assert.match(output,/Quiet moments alone help us grow closer to God/);
  assert.match(output,/his senses at rest while he slept/);
  assert.match(output,/God could communicate with his mind more directly/);
  assert.match(output,/1 Kings 3:5/);
  assert.match(output,/if the day has been busy for him/);
});

test('narrow exact Filipino post-polish improves screenshot terms without altering ordinary text',()=>{
  const machine='Ang mga token ng presensya ng Diyos. Sa panuntunan sa ating pagsamba, may mapagbigay na sakripisyo. Ang katahimikan at pagreretiro ay nakatutulong. Ang kanyang mga pandama ay naka-lock, kaya bukas ang pag-access ng Diyos sa kanyang isip.';
  const readable=polishHenryFilipinoTranslation(machine);
  for (const expected of [
    'mga tanda ng presensya ng Diyos',
    'tamang paraan ng pagsamba',
    'masaganang handog',
    'katahimikan at pag-iisa',
    'hindi niya namamalayan ang paligid habang natutulog',
    'pakikipag-ugnayan ng Diyos sa kanyang isip'
  ]) assert.ok(readable.includes(expected),expected);
  assert.ok(!readable.includes('naka-lock'));
  assert.equal(polishHenryFilipinoTranslation('Ang pag-access sa bank account ay ligtas.'), 'Ang pag-access sa bank account ay ligtas.');
  assert.equal(polishHenryFilipinoTranslation('Hindi sinabi ng Diyos ang 1 Kings 3:6.'),'Hindi sinabi ng Diyos ang 1 Hari 3:6.');
  assert.equal(polishHenryFilipinoTranslation('Ang handog , ay maganda .'),'Ang handog, ay maganda.');
});

test('full sentence groups, cache version and original English fallback preserve offline behavior',()=>{
  assert.match(source,/henry-translation-v3:/);
  assert.match(source,/prepareHenryEnglishForFilipino\(formatHenryBibleReferences\(text, 'en'\)\)/);
  assert.match(source,/splitHenryTranslation\(paragraph, targetLanguage === 'tl' \? 700 : 1600\)/);
  assert.match(source,/targetLanguage === 'tl' \? polishHenryFilipinoTranslation\(rawOutput\) : rawOutput/);
  assert.match(source,/translateText\(part, 'en', targetLanguage, true\)/);
  assert.match(source,/getOfflineCache/);
  assert.match(source,/setOfflineCache/);
  assert.equal(splitHenryTranslation('One two. Three four.',12).join(' '),'One two. Three four.');
  assert.equal(functions.normalizeHenryLanguage('fil-PH','ASD'),'tl');
});


test('Matthew Henry 1 Kings 3 labels and references are natural and precise without guessing unknown citations', () => {
  const input='KG1 3: 3; SA2 12:24; CH1 28: 9; CH1 28:10. Unknown 7:8.';
  assert.equal(formatHenryBibleReferences(input,'tl'),
    '1 Hari 3:3; 2 Samuel 12:24; 1 Cronica 28:9; 1 Cronica 28:10. Unknown 7:8.');
  assert.equal(formatHenryBibleReferences('1Ki 3:3; 2Sa 12:24; 1Ch 28:9','en'),
    '1 Kings 3:3; 2 Samuel 12:24; 1 Chronicles 28:9');
  assert.equal(formatHenryBibleReferences('1 Kings 3:3; 2 Samuel 12:24; 1 Chronicles 28:9','tl'),
    '1 Hari 3:3; 2 Samuel 12:24; 1 Cronica 28:9');
  assert.equal(formatHenryBibleReferences('SA2 0:3; CH1 151:2','tl'), 'SA2 0:3; CH1 151:2');
});

test('numbered sections become readable paragraphs without altering quoted original', () => {
  const original='We learn about Solomon, I. Something good. 1. He loved the Lord. 2. He followed the example of David.';
  const paragraphs=paragraphizeHenryEnglish(original);
  assert.equal(paragraphs.length,4);
  assert.match(paragraphs[0],/We learn about Solomon\./);
  assert.match(paragraphs[1],/^1\. Something good\.$/);
  assert.match(paragraphs[2],/^1\. He loved the Lord\.$/);
  assert.match(paragraphs[3],/^2\. He followed the example of David\.$/);
  assert.ok(original.includes(', I. Something'));
});

test('source idioms, residual English and Bible references from screenshots get conservative fixes', () => {
  const old='Here we are told concerning Solomon. What an encomium! He walked in the statutes of David his father, 1Ki 3:3.';
  const prepared=prepareHenryEnglishForFilipino(formatHenryBibleReferences(old,'en'));
  assert.match(prepared,/We learn about Solomon/);
  assert.match(prepared,/high praise/);
  assert.match(prepared,/He followed the practices of his father David/);
  assert.match(prepared,/1 Kings 3:3/);
  const translated='Narito kami na sinabi tungkol sa Solomon. Ang partikular na paunawa ay encomium, dapat na imitated. KG1 3: 3; SA2 12:24.';
  const output=polishHenryFilipinoTranslation(translated);
  assert.match(output,/kay Solomon/);
  assert.match(output,/mahalagang pahiwatig/);
  assert.match(output,/papuri, dapat na tularan/);
  assert.match(output,/1 Hari 3:3; 2 Samuel 12:24/);
  assert.equal(polishHenryFilipinoTranslation('Hindi niya sinunod ang utos.'),'Hindi niya sinunod ang utos.');
});

test('translation pipeline preserves offline per-account caching and English fallback', () => {
  assert.match(source,/translatedParagraphs\.join\('\\n\\n'\)/);
  assert.match(source,/targetLanguage === 'tl'\s*\?\s*paragraphizeHenryEnglish\(inputText\) : \[inputText\]/);
  assert.match(source,/if \(!getSupportedTranslationLanguages\(\)\.includes\(targetLanguage\)\)/);
  assert.match(source,/getOfflineCache<\{text: string\}>/);
  assert.match(source,/setOfflineCache\(key, \{text: output\}/);
  assert.match(source,/userId: accountId/);
  assert.match(source,/targetLanguage === 'tl' \? polishHenryFilipinoTranslation\(rawOutput\) : rawOutput/);
});
