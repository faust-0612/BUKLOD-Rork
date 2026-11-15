import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
function records(path) {
  const input=source(path);
  const start=input.indexOf(' = [');
  const end=input.lastIndexOf(' as const;');
  assert.ok(start>0 && end>start, path+' must contain static, offline records');
  return JSON.parse(input.slice(start+3,end));
}
function notes() {
  const input=source('src/features/childrenStories/bibleExpansion.ts');
  const prefix='const NEW_MORALS: Record<string,StoryLocalized> = ';
  const start=input.indexOf(prefix);
  const end=input.indexOf(';\nconst FOR_YOUNGER', start);
  assert.ok(start>=0 && end>start);
  return JSON.parse(input.slice(start+prefix.length,end));
}
const ot=records('src/features/childrenStories/bibleExpansionOld.ts');
const nt=records('src/features/childrenStories/bibleExpansionNew.ts');
const all=[...ot,...nt];

test('132 unique, offline, original bilingual biblical narratives span both testaments',()=>{
  assert.equal(ot.length,57);
  assert.equal(nt.length,75);
  assert.equal(new Set(all.map(s=>s.id)).size,all.length);
  assert.equal(new Set(all.map(s=>s.reference)).size,all.length);
  assert.ok(all.every(s=>s.testament==='old'||s.testament==='new'));
  assert.ok(all.every(s=>s.title.tl && s.title.en && s.reference && s.book));
  assert.ok(all.every(s=>/^[a-z0-9-]{3,70}$/.test(s.id)));
  assert.ok(all.every(s=>s.acts.length===3));
  for(const story of all){
    for(const part of story.acts){
      assert.ok(part.tl.length>35,story.id+' TL');
      assert.ok(part.en.length>35,story.id+' EN');
    }
  }
});
test('narratives include named canonical coverage and references for teaching',()=>{
  const ids=new Set(all.map(s=>s.id));
  for(const id of ['paglikha','abraham-tawag','baby-moses','manna','sampung-utos','ruth-naomi','samuel-tinawag','esther','daniel-leon','habakkuk-tiwala','kapanganakan-hesus','mga-pastol','mga-bata-jesus','manghahasik','nawawalang-tupa','tinapay-isda','krus','walang-lamang-libingan','pentecostes','saul-damasco','bagong-langit-lupa']){
    assert.ok(ids.has(id),id+' missing');
  }
  assert.ok(ot.every(s=>s.testament==='old'));
  assert.ok(nt.every(s=>s.testament==='new'));
});
test('all New Testament entries have contextual bilingual values, separate from source events',()=>{
  const entries=notes();
  assert.deepEqual(Object.keys(entries).sort(),nt.map(s=>s.id).sort());
  for(const [id,moral] of Object.entries(entries)){
    assert.ok(moral.tl?.length>25,id+' TL moral');
    assert.ok(moral.en?.length>25,id+' EN moral');
  }
  assert.ok(ot.every(s=>s.moral?.tl && s.moral?.en));
});
test('existing reader, progress, classroom lessons and ad exclusion are preserved',()=>{
  const catalog=source('src/features/childrenStories/catalog.ts');
  const lessons=source('src/features/childrenStories/sundaySchool.ts');
  const library=source('src/app/children-stories/index.tsx');
  const reader=source('src/app/children-stories/[id].tsx');
  const adController=source('src/lib/buklodGlobalAdController.ts');
  assert.match(catalog,/\.\.\.BIBLE_EXPANSION_STORIES/);
  assert.match(lessons,/\.\.\.BIBLE_EXPANSION_LESSONS/);
  assert.match(library,/BIBLE_STORY_METADATA\[s.id\]/);
  assert.match(library,/Lumang Tipan/);
  assert.match(library,/Bagong Tipan/);
  assert.doesNotMatch(library,/12 offline stories/);
  assert.match(reader,/getSundaySchoolLesson/);
  const audio=source('src/features/childrenStories/storyNarration.ts');
  assert.match(reader,/StoryNarrator/);
  assert.match(reader,/narratorRef\.current\?\.dispose\(\)/);
  assert.match(audio,/this\.speech\.stop\(\)/);
  assert.match(reader,/saveStoryProgress/);
  assert.match(adController,/SENSITIVE_PREFIXES[\s\S]*'\/children-stories'/);
});
