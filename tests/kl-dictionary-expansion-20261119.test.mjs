import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const extras = read('src/lib/kabihasnang-ligaw/dictionaryExtras.ts');
const dictionary = read('src/lib/kabihasnang-ligaw/dictionary.ts');
const reader = read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
const rows = [...extras.matchAll(/^\s*\['([^']+)', '([^']+)', '([^']+)'\],?$/gm)]
  .map(match => ({ name: match[1], kind: match[2], meaning: match[3] }));
const original = [...dictionary.matchAll(/name: '([^']+)'/g)].map(match => match[1]);
const names = [...original, ...rows.map(row => row.name)];
const worlds = ['Lunawen', 'Dumalir', 'Ulnarik', 'Sanghira', 'Tigmalar',
  'Hatiran', 'Marukhan', 'Lampira', 'Kulimbay', 'Hulmalen', 'Dalamhira', 'Tahimir', 'Ilawin'];
const centralCharacters = ['Phan', 'Quin', 'Van', 'Christian', 'Lhen', 'Ace',
  'ELESUR', 'Jawo', 'Mitch', 'Niel', 'Angel', 'Vhen', 'Trudice'];

test('keeps the five baseline R5 terms and contains 119 new, unique terms', () => {
  assert.deepEqual(original, ['Lunawen', 'Dumalir', 'Sanghira', 'Marukha', 'Nalimor']);
  assert.equal(rows.length, 119);
  assert.equal(names.length, 124);
  assert.equal(new Set(names.map(name => name.toLowerCase())).size, names.length);
  assert.ok(rows.every(row => row.meaning.trim().length > 0));
});

test('includes all 13 worlds and the 13 central characters', () => {
  for (const name of [...worlds, ...centralCharacters]) {
    assert.ok(names.includes(name), name);
  }
});

test('whole-word, longest-first matching handles uppercase, punctuation and false positives', () => {
  const escapeRegExp = value => value.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
  const rx = new RegExp(
    '(^|[^\\p{L}\\p{M}\\p{N}])(' +
      [...names].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|') +
      ')(?=$|[^\\p{L}\\p{M}\\p{N}])',
    'giu',
  );
  const prose = 'Sa Puso ng Ugat, may kulay-kalawang na pisi; naroon si PHAN.';
  assert.deepEqual([...prose.matchAll(rx)].map(match => match[2].toLowerCase()),
    ['puso ng ugat', 'kulay-kalawang', 'pisi', 'phan']);
  assert.equal([...('Vanuatu, angelic, pagitanan at kapisihan').matchAll(rx)].length, 0);
  assert.match(dictionary, /DICTIONARY_PATTERN/);
  assert.match(dictionary, /dictionaryByName\(term\)\?\.name/);
});

test('the reader hides future names until they occur in readable prose', () => {
  assert.match(dictionary, /export function dictionaryForManuscript/);
  assert.match(dictionary, /BASE_KL_DICTIONARY\.includes\(entry\) \|\| mentioned\.has\(entry\.name\)/);
  assert.match(reader, /dictionaryForManuscript\(reading\.text \?\? ''\)\.map/);
  assert.doesNotMatch(reader, /KL_DICTIONARY\.map/);
});
