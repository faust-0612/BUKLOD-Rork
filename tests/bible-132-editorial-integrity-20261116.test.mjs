import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const expansion = source('src/features/childrenStories/bibleExpansion.ts');
const readRecords = name => {
  const raw = source('src/features/childrenStories/' + name);
  return JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));
};
const readEditorial = name => {
  const raw = source('src/features/childrenStories/' + name);
  return JSON.parse(raw.slice(raw.indexOf('= {') + 2, raw.lastIndexOf('};') + 1));
};
const records = [
  ...readRecords('bibleExpansionOld.ts'),
  ...readRecords('bibleExpansionNew.ts'),
];
const editorial = {
  ...readEditorial('bibleEditorialDepthOld.ts'),
  ...readEditorial('bibleEditorialDepthNewA.ts'),
  ...readEditorial('bibleEditorialDepthNewB.ts'),
};
const ids = records.map(entry => entry.id);

test('all 132 stories have unique editorial Bible detail in Filipino and English', () => {
  assert.equal(records.length, 132);
  assert.equal(new Set(ids).size, 132);
  assert.deepEqual(Object.keys(editorial).sort(), ids.slice().sort());
  for (const entry of records) {
    const depth = editorial[entry.id];
    assert.ok(depth, 'Missing editorial depth ' + entry.id);
    assert.match(entry.reference, /\d/, entry.id + ' needs a passage reference');
    for (const lang of ['tl', 'en']) {
      assert.ok(depth[lang].length >= 200, entry.id + ' incomplete ' + lang);
      assert.ok(depth[lang].split(/[.!?]/).filter(Boolean).length >= 3, entry.id + ' single-sentence filler ' + lang);
      assert.doesNotMatch(depth[lang], /\b(?:TODO|TBD|LOREM|PLACEHOLDER)\b/i, entry.id);
      assert.doesNotMatch(depth[lang], /pagkatapos ng kuwento|tanong ng bata|sagot ng klase|paliwanag ng guro|the teacher asked|after the story|fictional scene|not a fictional|hindi ito kathang/i, entry.id);
    }
  }
  for (const lang of ['tl', 'en']) {
    assert.equal(new Set(ids.map(id => editorial[id][lang])).size, 132, 'Each story requires unique editorial content');
  }
});

test('the actual in-story renderer and voice content share the same expanded text', () => {
  assert.match(expansion, /BIBLE_EDITORIAL_DEPTH_OLD/);
  assert.match(expansion, /BIBLE_EDITORIAL_DEPTH_NEW_A/);
  assert.match(expansion, /BIBLE_EDITORIAL_DEPTH_NEW_B/);
  assert.match(expansion, /EDITORIAL_DEPTH\[entry\.id\]\[language\]/);
  assert.match(expansion, /REVISED_BIBLICAL_SCENES\[entry\.id\]/);
  assert.match(expansion, /inStoryOnly\(/);
  assert.doesNotMatch(expansion, /Pagkatapos ng kuwento, nagtanong ang guro/);
  const reader = source('src/app/children-stories/[id].tsx');
  assert.match(reader, /localize\(lesson\.narrative,language\)/);
  assert.match(reader, /narrator\(\)\.play\(content,language,bedtime\)/);
  assert.match(reader, /lesson\.discussion\.map/);
  assert.match(reader, /localize\(lesson\.prayer,language\)/);
});

test('canonical story constraints guard false dramatic details', () => {
  assert.match(editorial['mga-pantas'].tl, /bahay/);
  assert.doesNotMatch(editorial['mga-pantas'].tl, /tatlong pantas|tatlong hari/i);
  assert.match(editorial['mga-pantas'].en, /house/);
  assert.match(editorial['joseph-panaginip'].tl, /bigkis/);
  assert.match(editorial['abraham-bituin'].tl, /Isaac/);
  assert.match(editorial['talento'].en, /money/);
  assert.match(editorial['buto-mustasa'].tl, /mustasa/);
  assert.match(editorial['bunga-espiritu'].en, /self-control/);
});
