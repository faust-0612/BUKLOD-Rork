import { strict as assert } from 'node:assert';
import { groupPermissionIncidents } from './global-stability-incident-guard.mjs';
const at=(sec)=>new Date(Date.UTC(2026,9,22,18,37,sec)).toISOString();
const events=[
{timestamp:at(36),message:'permission denied for table buklod_scope_memberships'},
{timestamp:at(37),message:'permission denied for function get_my_buklod_claim_groups_v1'},
{timestamp:at(38),message:'permission denied for table buklod_dashboard_themes'},
{timestamp:at(39),message:'permission denied for table buklod_dashboard_themes'},
{timestamp:at(40),message:'Schema cache reloaded'},
{timestamp:at(55),message:'permission denied for table buklod_dashboard_themes'},
{timestamp:new Date(Date.UTC(2026,9,22,19,1)).toISOString(),message:'permission denied for table buklod_dashboard_themes'}
];
const groups=groupPermissionIncidents(events);
assert.equal(groups.length,2);
assert.equal(groups[0].count,5);
assert.equal(groups[0].resourceCount,3);
assert.equal(groups[0].crossModule,true);
assert.equal(groups[1].count,1);
assert.equal(groups[1].crossModule,false);
assert.deepEqual(groupPermissionIncidents([]),[]);
console.log('Incident grouping guard PASS');
