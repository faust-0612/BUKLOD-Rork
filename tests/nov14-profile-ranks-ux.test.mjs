import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Profile exact rank source and de-duplicated popup',()=>{
 const me=read('src/app/(tabs)/me.tsx'),focus=read('src/components/BuklodFoundationWorkspaceNav.tsx');
 assert.match(me,/loadBuklodPointsDashboard/);
 assert.match(me,/value\.all_time_rank/);assert.match(me,/value\.monthly_rank/);
 const modal=me.slice(me.indexOf('visible={profileMenuOpen}'),me.indexOf('</Modal>',me.indexOf('visible={profileMenuOpen}')));
 assert.doesNotMatch(modal,/Notifications|Lock Profile/);
 assert.match(me,/Lock Profile/);
 assert.doesNotMatch(me,/How Account Deletion Works|Pilot Checklist/);
 assert.doesNotMatch(focus,/title="BUKLOD Kingdom"/);
 assert.match(focus,/title="BUKLOD Focus Apps"/);
});