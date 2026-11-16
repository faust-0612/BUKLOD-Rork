import test from 'node:test';
import assert from 'node:assert/strict';
import {initialAdventure,ADVENTURE_STORIES,ADVENTURE_RELICS,performAdventure,adventureXpForLevel,bondTier,badgeTier,journeyNextGoal,strength} from '../src/lib/buklodCharacterAdventure.ts';
const phan=()=>initialAdventure('phan');
const day=i=>new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10);
const practice=(s,i,type='wisdom',answer=1)=>performAdventure(s,{type:'practice',challenge:type,answer,day:day(i)});
test('all 13 actual characters have non-empty story and meaningful choices',()=>{
  assert.equal(Object.keys(ADVENTURE_STORIES).length,13);
  for(const story of Object.values(ADVENTURE_STORIES)){
    assert.equal(story.chapters.length,3);
    assert.equal(story.dilemmas.length,3);
    assert.equal(story.choices.length,3);
    assert.ok(story.choices.every(x=>x.length===2));
  }
});
test('quadratic progression, no mutating input',()=>{
  const before=phan(); const a=performAdventure(before,{type:'chapter',chapter:0,choice:'heart'});
  assert.ok(a.changed);assert.equal(before.xp,0);assert.equal(a.state.xp,65);
  assert.ok(adventureXpForLevel(3)-adventureXpForLevel(2)<adventureXpForLevel(19)-adventureXpForLevel(18));
  assert.equal(strength(a.state),a.state.level);
});
test('chapter is one-time, branch permanent, later story requires previous and bond',()=>{
  const start=phan();
  assert.equal(performAdventure(start,{type:'chapter',chapter:1,choice:'heart'}).changed,false);
  let s=performAdventure(start,{type:'chapter',chapter:0,choice:'heart'}).state;
  assert.equal(performAdventure(s,{type:'chapter',chapter:0,choice:'courage'}).changed,false);
  assert.equal(s.chapters[0],'heart');
  s=performAdventure(s,{type:'chapter',chapter:1,choice:'courage'}).state;
  assert.equal(performAdventure(s,{type:'chapter',chapter:2,choice:'heart'}).changed,false);
  s=practice(s,0).state;
  s=performAdventure(s,{type:'chapter',chapter:2,choice:'courage'}).state;
  assert.equal(s.chapters[2],'courage');assert.equal(s.hiddenPaths,1);
});
test('daily practice rejects wrong answer and replay, does not farm rewards',()=>{
  const s=phan();assert.equal(practice(s,0,'wisdom',0).changed,false);
  const a=practice(s,0).state;
  assert.equal(practice(a,0).changed,false);
  assert.equal(a.practiceDays.length,1);
  assert.equal(a.streak,1);
});
test('streak grace forgives one missed day, then resets when missed again',()=>{
  let s=practice(phan(),0).state;
  s=practice(s,2).state;
  assert.equal(s.streak,2);assert.equal(s.graceAvailable,false);
  s=practice(s,4).state;
  assert.equal(s.streak,1);assert.equal(s.graceAvailable,true);
  assert.equal(practice(s,3).changed,false);
});
test('relics assemble with three fragments; duplicates refine to noncash dust',()=>{
  let s=phan();for(let i=0;i<3;i++)s=practice(s,i).state;
  assert.equal(s.fragments.wisdom,3);
  s=performAdventure(s,{type:'craft',relic:'wisdom'}).state;
  assert.equal(s.relics.wisdom,1);assert.equal(s.fragments.wisdom,0);
  assert.equal(badgeTier(s,'collector'),'bronze');
  for(let i=3;i<6;i++)s=practice(s,i).state;
  const twice=performAdventure(s,{type:'craft',relic:'wisdom'});
  assert.equal(twice.changed,false);
  s=performAdventure(s,{type:'refine',relic:'wisdom'}).state;
  assert.equal(s.dust,2);assert.equal(s.relics.wisdom,1);
  assert.equal(performAdventure(s,{type:'refine',relic:'wisdom'}).changed,false);
});
test('tier gate blocks grinding until meaningful challenge is satisfied',()=>{
  let s=performAdventure(phan(),{type:'chapter',chapter:0,choice:'heart'}).state;
  for(let i=0;i<20;i++)s=practice(s,i).state;
  assert.equal(s.level,4);
  assert.equal(performAdventure(s,{type:'gate',gate:8}).changed,false);
  const g=performAdventure(s,{type:'gate',gate:4});
  assert.ok(g.changed);assert.ok(g.state.level>4);assert.equal(g.state.xp,s.xp);
});
test('ascension retains items, bond and personal history and resets adventure only',()=>{
  let s=phan();s.xp=adventureXpForLevel(20);s.bond=200;
  s.gates=[4,8,12,16];s.level=20;s.relics.origin=1;
  s.chapters={'0':'heart'};
  const result=performAdventure(s,{type:'ascend'});assert.ok(result.changed);
  assert.equal(result.state.level,1);assert.equal(result.state.xp,0);
  assert.equal(result.state.ascensions,1);assert.equal(result.state.relics.origin,1);
  assert.equal(result.state.bond,200);assert.equal(strength(result.state),3);
  assert.equal(s.level,20);
});
test('badge tiers and next goals are based on activity not lifetime BUKLOD points',()=>{
  let s=phan();assert.equal(badgeTier(s,'story'),'none');
  assert.match(journeyNextGoal(s),/Continue/);
  s=performAdventure(s,{type:'chapter',chapter:0,choice:'heart'}).state;
  assert.equal(badgeTier(s,'story'),'bronze');
  assert.equal(bondTier(s.bond),1);
  assert.equal(bondTier(180),5);
});
test('invalid input cannot create free award, consume assets or cause restart',()=>{
  const s=phan();
  assert.throws(()=>performAdventure(s,{type:'practice',challenge:'service',answer:1,day:'wrong'}),/Invalid/);
  assert.throws(()=>performAdventure(s,{type:'craft',relic:'fake'}),/Unknown/);
  assert.equal(performAdventure(s,{type:'ascend'}).changed,false);
  assert.equal(performAdventure(s,{type:'gift',day:day(0)}).changed,false);
  assert.equal(s.hibla,0);
  assert.equal(ADVENTURE_RELICS.length,5);
});
test('complete relic set unlocks cosmetic-only gallery; ending respects choices',async()=>{
  const {relicSetProgress,adventureEnding,isDuoUnlocked}=await import('../src/lib/buklodCharacterAdventure.ts');
  const s=phan();assert.equal(relicSetProgress(s).scene,'Starting Corner');
  s.relics.origin=1;s.relics.wisdom=1;assert.equal(relicSetProgress(s).scene,'Living Room');
  for(const r of ADVENTURE_RELICS)s.relics[r]=1;
  assert.equal(relicSetProgress(s).scene,'Legacy Gallery');
  s.chapters={'0':'heart','1':'courage','2':'heart'};
  assert.equal(adventureEnding(s),'Balanced Legacy');
  const duo=initialAdventure('van');duo.bond=90;s.bond=90;
  assert.equal(isDuoUnlocked(s,duo),true);
  assert.equal(isDuoUnlocked(s,s),false);
});
test('duplicate dust selects only a missing relic, with no real-money conversion',()=>{
  const s=phan();s.dust=7;
  assert.equal(performAdventure(s,{type:'exchange',relic:'service'}).changed,false);
  s.dust=8;
  const a=performAdventure(s,{type:'exchange',relic:'service'});
  assert.equal(a.changed,true);assert.equal(a.state.dust,0);
  assert.equal(a.state.relics.service,1);
  assert.equal(performAdventure(a.state,{type:'exchange',relic:'service'}).changed,false);
});
