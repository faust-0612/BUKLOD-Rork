import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateObjectiveAttempt, validateObjectiveBank, saliksikRewardKey } from '../src/lib/saliksikMastery.mjs';

const competencies=['understanding','evidence','context','reasoning','transfer'];
const makeBank = tier => competencies.flatMap((competency,i)=>
  Array.from({length:tier==='investigate'?2:1},(_,j)=>({
    id:competency+j,prompt:'Which grounded claim follows from passage '+competency+' case '+j+'?',
    options:['Correct source reasoning','Unrelated claim','Missing context','Invented event'],
    correctIndex:0,competency,evidence:'Verified source passage spanning at least twenty characters.',
  })));
const examine=(tier,answers,bank=makeBank(tier))=>evaluateObjectiveAttempt({
  tier,bank,questionOrder:bank.map((_,i)=>i),answers,
});

test('strict bank schema prevents answer leakage variants, duplicates and insufficient skill coverage',()=>{
  assert.equal(validateObjectiveBank('discover',makeBank('discover')),true);
  assert.equal(validateObjectiveBank('investigate',makeBank('investigate')),true);
  assert.equal(validateObjectiveBank('master',makeBank('discover')),false);
  assert.equal(validateObjectiveBank('discover',[...makeBank('discover'),makeBank('discover')[0]]),false);
  const b=makeBank('investigate'); b[4].id=b[1].id;
  assert.equal(validateObjectiveBank('investigate',b),false);
});
test('discover allows weighted independent 80%-plus and not malformed incomplete responses',()=>{
  assert.deepEqual({passed:examine('discover',[0,0,0,0,0]).passed,points:examine('discover',[0,0,0,0,0]).points},{passed:true,points:10});
  assert.equal(examine('discover',[0,0,0,0,1]).passed,true);
  assert.equal(examine('discover',[1,0,0,0,1]).passed,false);
  assert.equal(examine('discover',[0,0,0]).ok,false);
  assert.equal(examine('discover',[0,0,0,0,'0']).ok,false);
});
test('investigate 90% with a core competency miss is not enough for 20 points',()=>{
  const b=makeBank('investigate');
  const wrongOne=b.map(()=>0);wrongOne[2]=1; // Evidence: 1/2 => 50%
  const result=examine('investigate',wrongOne,b);
  assert.ok(result.score>=80);
  assert.equal(result.passed,false);
  assert.equal(result.points,0);
  assert.equal(result.reason,'core_weak');
  const all=examine('investigate',b.map(()=>0),b);
  assert.equal(all.passed,true);assert.equal(all.points,20);
});
test('master 35 requires independent written rubric; not payable by objective grading',()=>{
  const result=examine('master',[0,0,0,0,0]);
  assert.equal(result.ok,false);assert.equal(result.points,undefined);
});
test('attempt shuffling cannot change grades; manipulated or duplicated question ids denied',()=>{
  const b=makeBank('discover');
  const perm=[4,0,1,3,2];
  const grade=evaluateObjectiveAttempt({tier:'discover',bank:b,questionOrder:perm,answers:perm.map(()=>0)});
  assert.equal(grade.passed,true);
  assert.equal(evaluateObjectiveAttempt({tier:'discover',bank:b,questionOrder:[0,0,2,3,4],answers:[0,0,0,0,0]}).ok,false);
  assert.equal(evaluateObjectiveAttempt({tier:'discover',bank:b,questionOrder:[0,1,2,3,9],answers:[0,0,0,0,0]}).ok,false);
});
test('unique credit key is deterministic by immutable investigation id and version',()=>{
 const id='12345678-1234-1234-1234-123456789012';
 assert.equal(saliksikRewardKey(id,1),saliksikRewardKey(id.toUpperCase(),1));
 assert.notEqual(saliksikRewardKey(id,1),saliksikRewardKey(id,2));
 assert.throws(()=>saliksikRewardKey('x',1));
});
