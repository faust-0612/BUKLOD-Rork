import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const dialogueSource = read('src/features/childrenStories/sundaySchoolDialogues.ts');
const dialoguesMatch = dialogueSource.match(/export const SUNDAY_SCHOOL_DIALOGUES:[\s\S]*?=\s*(\{[\s\S]*\});\s*$/);
assert.ok(dialoguesMatch, 'Expected an explicit offline dialogue catalog');
const dialogues = JSON.parse(dialoguesMatch[1]);
const stories = {};
for (const block of ['A','B','C']) {
  const contents = read('src/features/childrenStories/sundaySchool' + block + '.ts');
  const match = contents.match(/export const LESSONS_[ABC]:[^\n]+ = (\{[\s\S]*\});\s*$/);
  assert.ok(match, 'Missing bundled lesson catalog ' + block);
  Object.assign(stories, JSON.parse(match[1]));
}
test('every bundled lesson has meaningful bilingual speech placed within existing story paragraphs', () => {
  assert.equal(Object.keys(stories).length, 12);
  assert.deepEqual(Object.keys(dialogues).sort(), Object.keys(stories).sort());
  let scenes = 0;
  for (const [id, entries] of Object.entries(dialogues)) {
    assert.ok(entries.length >= 1, id + ': needs character interaction');
    for (const lang of ['tl','en']) {
      const paragraphs = stories[id].narrative[lang].split(/\n\s*\n/);
      const result = paragraphs.flatMap((paragraph, index) => [
        paragraph.trim(), ...entries.filter(s=>s.afterParagraph===index).map(s=>s.speech[lang]),
      ]).join('\n\n');
      assert.ok(result.length > stories[id].narrative[lang].length, id + ':' + lang + ' must be longer');
      assert.ok(result.includes(paragraphs[0].trim()), id + ':' + lang + ' original Bible/values prose preserved');
      for (const entry of entries) {
        assert.ok(Number.isInteger(entry.afterParagraph) && entry.afterParagraph >= 0
          && entry.afterParagraph < paragraphs.length, id + ' invalid placement');
        assert.ok(entry.speech[lang].length >= 120, id + ':' + lang + ' meaningful dialogue length');
        assert.match(entry.speech[lang], /[“"][^”"]{7,}[”"]/, id + ':' + lang + ' direct dialogue');
        assert.ok(result.includes(entry.speech[lang]), id + ':' + lang + ' speech retained');
      }
    }
    scenes += entries.length;
  }
  assert.ok(scenes >= 20, 'At least twenty substantive teaching exchanges');
});
test('Bible narrations distinguish paraphrased biblical speech from direct Scripture quotations', () => {
  const source = read('src/features/childrenStories/sundaySchool.ts');
  const screen = read('src/app/children-stories/[id].tsx');
  assert.match(source, /withStorytellingDialogue\(id, lesson\)/);
  assert.match(source, /\.split\(\/\\n\\s\*\\n\/\)/);
  assert.match(source, /retellingNotice/);
  assert.match(source, /not word-for-word quotations/i);
  assert.match(screen, /localize\(lesson\.retellingNotice,language\)/);
  assert.match(screen, /localize\(lesson\.narrative,language\)/);
  assert.match(screen, /const content=quiz\?[\s\S]*?:lesson\?localize\(lesson\.narrative,language\)/);
  assert.match(screen, /StoryNarrator/);
  assert.match(screen, /narrator\(\)\.play\(content,language,bedtime\)/);
  assert.match(source, /\.\.\.BIBLE_EXPANSION_LESSONS/);
  assert.match(dialogues['bangka-ng-pag-asa'][0].speech.tl, /sinabi ng Diyos/i);
  assert.match(dialogues['si-jonas-at-ang-dagat'][0].speech.en, /God instructed/);
});
test('dark Bible reading uses reactive contrasting colors for both reader paths', () => {
  const index = read('src/app/bible/index.tsx');
  const reader = read('src/app/bible/read.tsx');
  const notifications = read('src/app/notifications/index.tsx');
  for(const content of [index, reader, notifications]) {
    assert.match(content, /useBuklodTheme/);
    assert.match(content, /useThemedShared/);
    assert.match(content, /theme\.textPrimary/);
    assert.match(content, /theme\.textMuted/);
  }
  assert.match(reader,/styles\.verseText,\s*\{color:theme\.textPrimary\}/);
  assert.match(reader,/styles\.verseText,\s*\{color:annotation\?\.highlight_color\?'#26372F':theme\.textPrimary\}/);
  assert.match(reader,/styles\.reference,\{color:theme\.textPrimary\}/);
  assert.match(notifications, /style=\[?\{?[^]*theme\.textPrimary/);
});
