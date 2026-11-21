import test from 'node:test';
import assert from 'node:assert/strict';
import {majorLevel,constructionStage,constructionPlan,nextMilestone,safeCosmetics,visualDevelopmentFeatures} from '../src/features/season2/world/constructionPlan.mjs';
test('preview selectors cannot overflow stages and major levels',()=>{
 assert.equal(majorLevel(Infinity),1);assert.equal(majorLevel(42),10);assert.equal(majorLevel(-8),1);
 assert.equal(constructionStage(100),4);assert.equal(constructionStage(-5),0);
});
test('independent tracks have increasingly demanding visible planning requirements',()=>{
 for(const track of ['lot','house','cluster']){
  const low=constructionPlan(track,1,0),high=constructionPlan(track,10,4);
  assert.ok(high.estimatedDevelopmentXp>low.estimatedDevelopmentXp);
  assert.ok(high.estimatedBuildMinutes>low.estimatedBuildMinutes);
  assert.equal(high.cannotCommitClientSide,true);
 }
 assert.ok(constructionPlan('cluster',3,2).estimatedDevelopmentXp>constructionPlan('house',3,2).estimatedDevelopmentXp);
 assert.throws(()=>constructionPlan('unknown',2,0));
});
test('five stages per major level lead to unbounded mastery, without granting any unlock',()=>{
 assert.deepEqual(nextMilestone(1,3),{level:1,stage:4,mastery:0});
 assert.deepEqual(nextMilestone(1,4),{level:2,stage:0,mastery:0});
 assert.deepEqual(nextMilestone(10,4,12),{level:10,stage:0,mastery:13});
});
test('corrupt or foreign cosmetic storage is normalized',()=>{
 assert.deepEqual(safeCosmetics({finish:'malicious',roof:'none',ground:null}),{finish:'stone',roof:'gable',ground:'grass'});
 assert.deepEqual(safeCosmetics({finish:'slate',roof:'hip',ground:'flower'}),{finish:'slate',roof:'hip',ground:'flower'});
});

test('the rendered scene changes progressively at all 10 major tiers across all tracks',()=>{
 for(const track of ['lot','house','cluster']){
  let before=[];
  for(let level=1;level<=10;level++){
   const finished=visualDevelopmentFeatures(track,level,4);
   assert.equal(finished.length,level);
   assert.notDeepEqual(finished,before);
   assert.equal(visualDevelopmentFeatures(track,level,2).length,level-1);
   before=finished;
  }
 }
});
