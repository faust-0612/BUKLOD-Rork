const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync('src/lib/buklodHenryTranslation.ts','utf8');
const js = stripTypeScriptTypes(source.replace(/^import .*;$/gm,''), {mode:'strip'}).replace(/^export /gm,'');
const ctx = {setTimeout,clearTimeout,Math,fetch:()=>{throw new Error('Translator test must never access network')}};
const functions = vm.runInNewContext(js + '\n({ prepareHenryEnglishForFilipino, polishHenryFilipinoTranslation, splitHenryTranslation, normalizeHenryLanguage, formatHenryBibleReferences, paragraphizeHenryEnglish, isHenryFilipinoTranslationReliable })',ctx,{filename:'buklodHenryTranslation.js'});
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
  assert.match(source,/henry-translation-v4:/);
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


test('1 Kings 3:5 commentary disambiguates the screenshot’s full English meaning BEFORE translation', () => {
  const english="We have here an account of a gracious visit which God paid to Solomon, and the communion he had with God in it, which put a greater honour upon Solomon than all the wealth and power of his kingdom did. I. The circumstances of this visit, Kg1 3:5. 1. The place. It was in Gibeon; that was the great high place, and should have been the only one, because there the tabernacle and the brazen altar were, Ch2 1:3. There Solomon offered his great sacrifices, and there God owned him more than in any other of the high places. The nearer we come to the rule in our worship the more reason we have to expect the tokens of God's presence.";
  const prepared=prepareHenryEnglishForFilipino(formatHenryBibleReferences(english,'en'));
  for (const phrase of [
    'description of God’s gracious visit to Solomon',
    'close fellowship Solomon had with God',
    'greater honor than all the wealth and power',
    'principal high place for worship',
    'the only high place used for worship',
    'bronze altar',
    'Solomon presented his great sacrificial offerings to God',
    'God showed greater acceptance of Solomon',
    'follow God’s instructions in our worship',
    'signs that God is present',
    '1 Kings 3:5',
    '2 Chronicles 1:3',
  ]) assert.ok(prepared.includes(phrase),phrase);
  assert.ok(!prepared.includes('God paid to Solomon'));
  assert.ok(!prepared.includes('God owned him'));
  assert.ok(!prepared.includes('account of a gracious visit'));
  assert.ok(english.includes('God paid to Solomon')); // Original English stays unaltered.
});

test('screenshot output is conservatively corrected without changing unrelated financial vocabulary', () => {
  const machine='Narito kami ng isang account ng isang mabait na pagdalaw na binayaran ng Diyos kay Solomon, at ang pakikipag-isa na kasama niya sa Diyos dito, na naglagay ng higit na karangalan kay Solomon kaysa sa lahat ng kayamanan at kapangyarihan. Ang mga kalagayan ng pagbisita na ito, KG1 3: 5. 1. Ang lugar. Nasa Gibeon; Iyan ang dakilang mataas na lugar, at dapat lamang ang isa, sapagkat doon ang tabernakulo at ang altar ng tanso ay, CH2 1:3. Doon ay inalok ni Solomon ang kanyang mga dakilang sakripisyo.';
  const got=polishHenryFilipinoTranslation(machine);
  for(const phrase of [
    'Narito ang salaysay ng mapagpalang pagdalaw ng Diyos kay Solomon',
    'pakikipag-ugnayan ni Solomon sa Diyos sa pagdalaw na iyon',
    'nagbigay kay Solomon ng higit na karangalan',
    'Ang mga pangyayari sa pagdalaw na ito',
    'dapat sana ay iyon lamang ang lugar na ginagamit para sa pagsamba',
    'Doon naghandog si Solomon ng kanyang mga dakilang hain sa Diyos',
    '1 Hari 3:5',
    '2 Cronica 1:3',
  ]) assert.ok(got.includes(phrase),phrase);
  assert.equal(polishHenryFilipinoTranslation('Ang bank account ay binayaran ngayon.'),
    'Ang bank account ay binayaran ngayon.');
});

test('semantic and Bible-reference checks fail closed rather than caching misleading Filipino', () => {
  const reliable=functions.isHenryFilipinoTranslationReliable;
  const source="We have here an account of a gracious visit which God paid to Solomon. There Solomon offered his great sacrifices, and there God owned him. 1 Kings 3:5; 2 Chronicles 1:3.";
  assert.equal(reliable(source,'Narito ang isang account na binayaran ng Diyos. Inalok ni Solomon. 1 Hari 3:5; 2 Cronica 1:3.'),false);
  assert.equal(reliable(source,'Mapagpalang pagdalaw ng Diyos kay Solomon. Naghandog si Solomon. 1 Hari 3:5.'),false);
  assert.equal(reliable(source,'Mapagpalang pagdalaw ng Diyos kay Solomon. Naghandog si Solomon, at tinanggap siya ng Diyos. 1 Hari 3:5; 2 Cronica 1:3.'),true);
  assert.equal(reliable('An unrelated account of a financial transaction.', 'Isang account ng transaksiyon.'),true);
  assert.equal(reliable('1 Kings 3:5', ''),false);
  assert.match(source, /if \(targetLanguage === 'tl' && !isHenryFilipinoTranslationReliable\(text, output\)\)/);
  assert.match(source, /setOfflineCache\(key, \{text: output\}/);
});
