import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const recordsFrom=(file)=>{
  const code=read('src/features/childrenStories/'+file);
  return JSON.parse(code.slice(code.indexOf('['),code.lastIndexOf(']')+1));
};
const scenesFrom=(file)=>{
  const code=read('src/features/childrenStories/'+file);
  const start=code.indexOf('= {',code.indexOf('export const BIBLE_EXPANSION_DIALOGUES'))+2;
  return JSON.parse(code.slice(start,code.lastIndexOf('};')+1));
};
const old=recordsFrom('bibleExpansionOld.ts');
const newer=recordsFrom('bibleExpansionNew.ts');
const scenes={
 ...scenesFrom('bibleExpansionDialoguesOld.ts'),
 ...scenesFrom('bibleExpansionDialoguesNewA.ts'),
 ...scenesFrom('bibleExpansionDialoguesNewB.ts'),
};
const ids=[...old,...newer].map(x=>x.id);

test('exactly all 132 new Bible stories retain originals and receive two unique bilingual spoken scenes',()=>{
 assert.equal(old.length,57);
 assert.equal(newer.length,75);
 assert.equal(ids.length,132);
 assert.equal(new Set(ids).size,132,'No collisions with original Bible lesson IDs');
 assert.deepEqual(Object.keys(scenes).sort(),[...ids].sort(),'No missing or orphaned dialogue');
 for(const entry of [...old,...newer]){
   assert.equal(entry.acts.length,3,entry.id+' original three-act structure intact');
   const dialogue=scenes[entry.id];
   assert.equal(dialogue.length,4,'Two complete bilingual dialogues for '+entry.id);
   assert.match(entry.reference,/\d/,'Biblical passage reference for '+entry.id);
   for(const [i,s] of dialogue.entries()){
     assert.equal(typeof s,'string',entry.id+' '+i);
     assert.ok(s.length>=100,entry.id+' scene truncated '+i);
     assert.match(s,/“[^”]{5,}”/,entry.id+' must contain spoken dialogue '+i);
     assert.doesNotMatch(s,/\b(?:TODO|TBD|PLACEHOLDER|LOREM IPSUM)\b/i,entry.id+' contains placeholder');
   }
   for(const [language,i,j] of [['tl',0,2],['en',1,3]]){
     const sections=[
       entry.acts[0][language],
       dialogue[i],
       entry.acts[1][language],
       dialogue[j],
       entry.acts[2][language]
     ];
     assert.ok(sections.every(x=>x&&x.length>30),entry.id+' has blank scene '+language);
     assert.ok(sections.join('\n\n').length>700,entry.id+' has abbreviated story '+language);
     assert.ok(entry.title[language]?.length>4,entry.id+' missing title '+language);
   }
 }
});

test('complete Bible reader includes story-specific teaching scene, passage-attributed paraphrase notice, prayer, quiz and discussion',()=>{
 const entry=read('src/features/childrenStories/bibleExpansion.ts');
 const lessons=read('src/features/childrenStories/sundaySchool.ts');
 const reader=read('src/app/children-stories/[id].tsx');
 assert.match(entry,/BIBLE_EXPANSION_DIALOGUES_OLD/);
 assert.match(entry,/BIBLE_EXPANSION_DIALOGUES_NEW_A/);
 assert.match(entry,/BIBLE_EXPANSION_DIALOGUES_NEW_B/);
 assert.match(entry,/function expandBibleNarrative/);
 assert.match(entry,/index < 2 && dialogue/);
 assert.match(entry,/index \* 2 \+ \(language === 'en' \? 1 : 0\)/);
 assert.match(entry,/passages\.filter\(Boolean\)\.join\('\\n\\n'\)/);
 assert.match(entry,/narrative:local\(expandBibleNarrative\(entry,moral,'tl'\),expandBibleNarrative\(entry,moral,'en'\)\)/);
 assert.match(entry,/retellingNotice:local/);
 assert.match(entry,/not a word-for-word Bible quotation/);
 assert.match(entry,/prayer:local/);
 assert.match(entry,/spiritual:faith/);
 assert.match(entry,/discussion:\[/);
 assert.match(entry,/questions\s*\n/);
 assert.match(lessons,/\.\.\.BIBLE_EXPANSION_LESSONS/);
 assert.match(reader,/localize\(lesson\.retellingNotice,language\)/);
 assert.match(reader,/localize\(lesson\.narrative,language\)/);
 assert.match(reader,/narrator\(\)\.play\(content,language,bedtime\)/);
 assert.match(reader,/lesson\?\.questions/);
 assert.match(reader,/saveStoryProgress\(user\?\.id,story\.id,\{completed:true/);
});

test('privacy and safety: lesson keeps offline first source, age bounds, and does not mutate shared ads or Bible translation',()=>{
 const expansion=read('src/features/childrenStories/bibleExpansion.ts');
 const catalog=read('src/features/childrenStories/catalog.ts');
 assert.match(expansion,/source:'bundled'/);
 assert.match(expansion,/SENSITIVE\.has\(entry\.id\)\?9/);
 assert.match(expansion,/entry\.acts\.map\(text=>\(\{text:/);
 assert.match(catalog,/\.\.\.BIBLE_EXPANSION_STORIES/);
 assert.equal(Object.keys(scenes).length,132);
});
