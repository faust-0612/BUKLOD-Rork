import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const parts=['sundaySchoolA.ts','sundaySchoolB.ts','sundaySchoolC.ts'];
const lessons=Object.assign({},...parts.map(filename=>{
  const source=read('src/features/childrenStories/'+filename);
  const assignment=source.indexOf(' = ');
  assert.ok(assignment>0,'Lesson file must contain typed static data');
  return JSON.parse(source.slice(assignment+3,source.lastIndexOf(';')).trim());
}));
test('12 full bilingual Sunday School stories are bundled, original and instruction-ready',()=>{
  assert.equal(Object.keys(lessons).length,12);
  for(const [id,lesson] of Object.entries(lessons)){
    assert.match(id,/^[a-z0-9-]+$/);
    for(const lang of ['tl','en']){
      assert.ok(lesson.narrative[lang].length>650,id+' missing full narrative in '+lang);
      assert.ok(lesson.moral[lang].length>35,id+' moral incomplete');
      assert.ok(lesson.spiritual[lang].length>35,id+' spiritual teaching incomplete');
      assert.ok(lesson.prayer[lang].length>25,id+' closing prayer missing');
    }
    assert.match(lesson.reference,/\d/);
    assert.equal(lesson.discussion.length,2,id+' needs teacher discussion prompts');
    assert.equal(lesson.questions.length,3,id+' needs three new check questions');
    for(const question of lesson.questions){
      assert.ok(question.prompt.tl&&question.prompt.en);
      assert.equal(question.choices.length,3);
      assert.ok(Number.isInteger(question.answer)&&question.answer>=0&&question.answer<3);
      for(const choice of question.choices)assert.ok(choice.tl&&choice.en);
    }
  }
});
test('reader shows one continuous story, moral/spiritual teaching and four-question completion',()=>{
  const reader=read('src/app/children-stories/[id].tsx');
  const all=read('src/features/childrenStories/sundaySchool.ts');
  assert.match(all,/getSundaySchoolLesson/);
  assert.match(all,/story\?\.source === 'bundled'/);
  assert.match(reader,/lesson\.narrative/);
  assert.match(reader,/lesson\.moral/);
  assert.match(reader,/lesson\.spiritual/);
  assert.match(reader,/lesson\.reference/);
  assert.match(reader,/lesson\.prayer/);
  assert.match(reader,/lesson\.discussion/);
  assert.match(reader,/\.\.\.\(lesson\?\.questions\?\?\[\]\)/);
  assert.match(reader,/questionIndex===questions\.length-1/);
  assert.match(reader,/setComplete\(true\)/);
  assert.match(reader,/Speech\.stop/);
  assert.match(reader,/speechToken\.current/);
  assert.match(reader,/compact=\{Boolean\(lesson\)\}/);
  assert.match(reader,/getSundaySchoolLesson\(story\)/);
});
test('Sunday School source does not change child account data, live content DB or native runtime',()=>{
  const path=read('src/features/childrenStories/sundaySchoolTypes.ts');
  assert.doesNotMatch(path,/childUserId|birthdate|child_name|admob|user_id/);
  const cfg=read('app.config.js');
  assert.match(cfg,/runtimeVersion: isClassroom \? '1\.3\.0' : '1\.3\.2'/);
});
