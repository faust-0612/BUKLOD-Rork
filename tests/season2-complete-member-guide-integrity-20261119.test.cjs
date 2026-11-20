'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const full=read('docs/season2/BUKLOD_COMPLETE_REWARDS_POINTS_TOKENS_ITEMS_BADGES_BONUSES_GUIDE_20261119.md');
const matrix=read('docs/season2/BUKLOD_DEC6_ALL_POINTS_REWARDS_REQUIREMENTS_DEDUCTIONS_20261119.md');
const catalog=read('docs/season2/BUKLOD_ALL_1300_ITEMS_469_BADGES_40_RANKS_20261119.md');
test('one complete guide includes entire dated economy master without dropped sections',()=>{
 const copied=matrix.replace(/^# BUKLOD Season 2 — December 6 Full Points, Rewards, Requirements & Deductions Master Inventory/,
  '# PART I — Points, QMP, rewards, missions, eligibility, deductions and launch gates');
 assert.ok(full.includes(copied),'economy master omitted or stale in joined user guide');
 assert.match(full,/46 active \/ 16 inactive/);
 assert.match(full,/Journey Tokens/);
 assert.match(full,/QMP/);
 assert.match(full,/Season 2 approved exclusives|Exactly 10 Season 2/);
 assert.match(full,/## 13\. Exact Season 2 readiness gates/);
});
test('one complete guide includes every one of the 1300 names and all 469 badges unchanged',()=>{
 const copied=catalog.replace(/^# BUKLOD — ALL 1,300 Character Items \+ ALL 469 Character Badges \+ 40 Circle Rank Classes/,
  '# PART II — Full catalogue of 1,300 items, 469 badges and 40 ranks');
 assert.ok(full.endsWith(copied),'full 1300/469 catalog was shortened or modified');
 assert.match(full,/1,300 individually named collectibles/);
 assert.match(full,/469 named Character badges/);
 assert.match(full,/40 Circle Rank visual classifications/);
 assert.match(full,/Finalized|financial/i);
});
test('full guide is factual and does not falsely announce early rewards',()=>{
 assert.match(full,/NOT LIVE/);
 assert.match(full,/production Season 1 remains unchanged/i);
 assert.match(full,/December 6/);
 assert.match(full,/No automatic|no automatic|cannot automatically/i);
 assert.match(full,/art assets.*badge names.*ownership/i);
});
