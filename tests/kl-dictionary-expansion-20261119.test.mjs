import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const asModule = source => 'data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(source));
const extrasUrl = asModule(read('src/lib/kabihasnang-ligaw/dictionaryExtras.ts'));
const dictionary = read('src/lib/kabihasnang-ligaw/dictionary.ts');
const { KL_DICTIONARY, splitDictionaryTerms, dictionaryForManuscript, dictionaryByName } =
  await import(asModule(dictionary.replace("'./dictionaryExtras'", JSON.stringify(extrasUrl))));
const reader = read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
const names = KL_DICTIONARY.map(entry => entry.name);
const worlds = ['Lunawen','Dumalir','Ulnarik','Sanghira','Tigmalar','Hatiran','Marukhan','Lampira','Kulimbay','Hulmalen','Dalamhira','Tahimir','Ilawin'];
const characters = ['Phan','Quin','Van','Christian','Lhen','Ace','ELESUR','Jawo','Mitch','Niel','Angel','Vhen','Trudice'];
const hits = prose => {
  const parts = splitDictionaryTerms(prose);
  assert.equal(parts.map(p=>p.text).join(''),prose);
  return parts.filter(p=>p.term).map(p=>p.term);
};
test('preserves R5 and at least 146 unique, defined glossary terms', () => {
  assert.deepEqual(names.slice(0,5),['Lunawen','Dumalir','Sanghira','Marukha','Nalimor']);
  assert.ok(names.length >= 146);
  assert.equal(new Set(names.map(name=>name.toLowerCase())).size,names.length);
  assert.ok(KL_DICTIONARY.every(entry=>entry.meaning.trim().length>0));
});
test('canonical worlds, characters and revised manuscript vocabulary are included', () => {
  for(const name of [...worlds,...characters,'Dalungaw','Balat-bato','Matandang Tagaakyat','Gagamba ng Pisi','El','Yam','Bogo','Narek','Pinto ng Dumalir']) assert.ok(names.includes(name),name);
});
test('matches whole terms, longer phrases and aliases while preserving text', () => {
  assert.deepEqual(hits('Sa Puso ng Ugat, may kulay-kalawang na pisi; naroon si PHAN.'),['Puso ng Ugat','kulay-kalawang','pisi','Phan']);
  assert.deepEqual(hits('Vanuatu, angelic, pagitanan at kapisihan'),[]);
  assert.deepEqual(hits('Si Tali ay may tali. Calen, Dalungaw, Balat-batong bantay, El at Yam.'),['Tali','Maestro Calen','Dalungaw','Balat-bato','El','Yam']);
  assert.deepEqual(hits('Pinto ng Dumalir, pulang latak, ilog na dumadaloy paakyat.'),['Pinto ng Dumalir','Mapulang latak','Mga ilog na umaakyat']);
  assert.equal(dictionaryByName('Calen')?.name,'Maestro Calen');
});
test('extra glossary entries require a mention in readable prose',()=>{
  const shown = dictionaryForManuscript('Si Tali at Elyam ay nasa Dumalir.').map(e=>e.name);
  assert.ok(shown.includes('Elyam'));
  assert.ok(!shown.includes('Narek'));
  assert.match(reader,/dictionaryForManuscript\(reading\.text \?\? ''\)\.map/);
  assert.doesNotMatch(reader,/KL_DICTIONARY\.map/);
});
