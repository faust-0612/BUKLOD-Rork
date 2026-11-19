'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const bubble=fs.readFileSync(path.join(root,'src/components/connect/ConnectMessageBubble.tsx'),'utf8');
const matrix=fs.readFileSync(path.join(root,'src/lib/season2/buklodSeason2MemberRewardMatrixR1.ts'),'utf8');
test('Connect message time row remains syntactically valid and compact',()=>{
 assert.match(bubble,/timeRow:\s*\{[\s\S]*?flexDirection:\s*'row',\s*alignItems:\s*'center',/);
 assert.match(bubble,/marginTop:\s*2/);
 assert.match(bubble,/gap:\s*5/);
 assert.doesNotMatch(bubble,/flexDirection:\s*'row'\s+alignItems:/);
});
test('Connect repair cannot introduce season points or wallet grants',()=>{
 assert.doesNotMatch(bubble,/S2_JOURNEY_TOKEN|buklod_s2|grantSeason|creditToken|awardBP/);
 assert.match(matrix,/automaticActivation:false/);
});
