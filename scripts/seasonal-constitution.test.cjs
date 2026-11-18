'use strict';
const assert=require('node:assert/strict');
const {evaluateSeasonProposal,PROTECTED,RESETTABLE,RELEASE_GATES}=require('./seasonal-constitution.cjs');
for(const target of PROTECTED) {
 const r=evaluateSeasonProposal({changes:[{target,operation:'reset'}]});
 assert.equal(r.allowed,false,target);
 assert.ok(r.warnings.some(w=>w.code==='PERMANENT_PROGRESS_RESET'));
}
for(const target of RESETTABLE)
 assert.equal(evaluateSeasonProposal({changes:[{target,operation:'reset'}]}).allowed,true,target);
assert.equal(evaluateSeasonProposal({changes:[{target:'season1_rules',operation:'update'}]}).allowed,false);
assert.equal(evaluateSeasonProposal({changes:[{target:'wallet_token',operation:'expire'}]}).allowed,false);
assert.equal(evaluateSeasonProposal({release:'production',evidence:{}}).warnings.filter(w=>w.code==='MISSING_RELEASE_EVIDENCE').length,RELEASE_GATES.length);
assert.equal(evaluateSeasonProposal({release:'production',evidence:Object.fromEntries(RELEASE_GATES.map(x=>[x,true]))}).allowed,true);
console.log('Seasonal constitutional contract checks passed');
