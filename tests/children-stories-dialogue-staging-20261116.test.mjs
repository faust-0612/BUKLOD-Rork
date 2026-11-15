import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const dialoguesSource = read('src/features/childrenStories/sundaySchoolDialogues.ts');
const anchor = dialoguesSource.indexOf('export const SUNDAY_SCHOOL_DIALOGUES');
assert.ok(anchor > 0, 'Dialogues must be exported for actual story rendering');
const start = dialoguesSource.indexOf('= {', anchor) + 2;
const end = dialoguesSource.lastIndexOf('};') + 1;
const dialogues = JSON.parse(dialoguesSource.slice(start, end));

function baseNarratives() {
  const result = {};
  for (const suffix of ['A','B','C']) {
    const source = read('src/features/childrenStories/sundaySchool' + suffix + '.ts');
    const ids = [...source.matchAll(/^  "([^"]+)": \{/gm)].map(match => match[1]);
    for (let i = 0; i < ids.length; i++) {
      const head = source.indexOf('  "' + ids[i] + '": {');
      const tail = i + 1 < ids.length ? source.indexOf('  "' + ids[i + 1] + '": {') : source.length;
      const block = source.slice(head, tail);
      const tl = block.match(/"narrative":\s*\{\s*"tl":\s*("(?:\\.|[^"\\])*")/);
      const en = block.match(/"narrative":\s*\{\s*"tl":\s*"(?:\\.|[^"\\])*",\s*"en":\s*("(?:\\.|[^"\\])*")/);
      assert.ok(tl && en, 'Every story needs full bilingual narrative: ' + ids[i]);
      result[ids[i]] = {
        tl: JSON.parse(tl[1]).split(/\n\s*\n/).length,
        en: JSON.parse(en[1]).split(/\n\s*\n/).length,
      };
    }
  }
  return result;
}

test('all existing Sunday School stories contain complete in-sequence bilingual dialogue', () => {
  const narratives = baseNarratives();
  assert.equal(Object.keys(narratives).length, 12);
  assert.deepEqual(Object.keys(dialogues).sort(), Object.keys(narratives).sort());
  const total = Object.values(dialogues).reduce((n, scenes) => n + scenes.length, 0);
  assert.ok(total >= 45, 'Dialogue coverage must not regress below 45 scenes');
  for (const [id, scenes] of Object.entries(dialogues)) {
    assert.ok(scenes.length >= 3, 'At least three spoken scenes: ' + id);
    const indices = new Set();
    for (const scene of scenes) {
      assert.ok(Number.isSafeInteger(scene.afterParagraph) && scene.afterParagraph >= 0, id);
      assert.ok(!indices.has(scene.afterParagraph), 'Duplicate scene anchor in ' + id);
      indices.add(scene.afterParagraph);
      for (const lang of ['tl','en']) {
        assert.ok(scene.afterParagraph < narratives[id][lang], 'Unreachable scene for ' + id + '/' + lang);
        assert.ok(scene.speech[lang].length >= 85, 'Truncated dialogue for ' + id + '/' + lang);
        assert.match(scene.speech[lang], /“[^”]+”/, 'Actual conversation missing: ' + id + '/' + lang);
      }
    }
  }
});

test('same continuous narration and printed story include every dialogue without changing quizzes', () => {
  const lesson = read('src/features/childrenStories/sundaySchool.ts');
  const reader = read('src/app/children-stories/[id].tsx');
  const types = read('src/features/childrenStories/sundaySchoolTypes.ts');
  assert.match(lesson, /SUNDAY_SCHOOL_DIALOGUES\[id\]/);
  assert.match(lesson, /scenes\.filter\(scene => scene\.afterParagraph === index\)/);
  assert.match(lesson, /story\?\.source === 'bundled'/);
  assert.match(types, /retellingNotice\?: StoryLocalized/);
  assert.match(lesson, /not word-for-word quotations of Bible verses/);
  assert.match(reader, /localize\(lesson\.retellingNotice,language\)/);
  assert.match(reader, /localize\(lesson\.narrative,language\)/);
  assert.match(reader, /lesson\?\.questions/);
  assert.match(reader, /saveStoryProgress/);
  assert.match(reader, /Speech\.speak\(chunks\[index\+\+\]/);
});
